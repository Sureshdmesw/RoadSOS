import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const getEncryptionKey = (): Buffer => {
  const encodedKey = process.env.ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error(
      "ENCRYPTION_KEY is not configured in the environment"
    );
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "ENCRYPTION_KEY must decode to exactly 32 bytes"
    );
  }

  return key;
};

/*
|--------------------------------------------------------------------------
| Encrypt
|--------------------------------------------------------------------------
|
| AES-256-GCM provides:
|
| - Confidentiality
| - Integrity
| - Authentication
|
*/

export const encryptData = (
  data: unknown
): string => {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  const plaintext = JSON.stringify(data);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  /*
  |--------------------------------------------------------------------------
  | Stored format
  |--------------------------------------------------------------------------
  |
  | iv.authTag.ciphertext
  |
  | Everything is Base64 encoded.
  |
  */

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
};

/*
|--------------------------------------------------------------------------
| Decrypt
|--------------------------------------------------------------------------
*/

export const decryptData = <T>(
  encryptedData: string
): T => {
  const key = getEncryptionKey();

  const parts = encryptedData.split(".");

  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted data format"
    );
  }

  const [
    ivBase64,
    authTagBase64,
    ciphertextBase64,
  ] = parts;

  const iv = Buffer.from(
    ivBase64,
    "base64"
  );

  const authTag = Buffer.from(
    authTagBase64,
    "base64"
  );

  const ciphertext = Buffer.from(
    ciphertextBase64,
    "base64"
  );

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      "Invalid encryption IV"
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      "Invalid encryption authentication tag"
    );
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(
    decrypted.toString("utf8")
  ) as T;
};