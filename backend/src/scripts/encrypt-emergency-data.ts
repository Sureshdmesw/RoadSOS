import dotenv from "dotenv";

import pool from "../config/database.js";
import {
  encryptData,
} from "../utils/encryption.js";

dotenv.config();

interface EmergencyRow {
  id: number;
  latitude: string;
  longitude: string;
  message: string | null;
}

const migrate = async () => {
  let connection;

  try {
    console.log(
      "Starting RoadSOS emergency-data encryption migration..."
    );

    connection =
      await pool.getConnection();

    /*
    |--------------------------------------------------------------------------
    | Add encrypted column
    |--------------------------------------------------------------------------
    */

    await connection.execute(
      `ALTER TABLE emergency_events
       ADD COLUMN encrypted_payload LONGTEXT NULL
       AFTER emergency_type`
    );

    /*
    |--------------------------------------------------------------------------
    | Read existing plaintext records
    |--------------------------------------------------------------------------
    */

    const [rows] = await connection.execute(
      `SELECT
         id,
         latitude,
         longitude,
         message
       FROM emergency_events`
    );

    const emergencies =
      rows as EmergencyRow[];

    console.log(
      `Found ${emergencies.length} existing emergency records.`
    );

    /*
    |--------------------------------------------------------------------------
    | Encrypt existing records
    |--------------------------------------------------------------------------
    */

    for (const emergency of emergencies) {
      const payload = {
        latitude: Number(
          emergency.latitude
        ),

        longitude: Number(
          emergency.longitude
        ),

        message:
          emergency.message ?? null,
      };

      const encryptedPayload =
        encryptData(payload);

      await connection.execute(
        `UPDATE emergency_events
         SET encrypted_payload = ?
         WHERE id = ?`,
        [
          encryptedPayload,
          emergency.id,
        ]
      );

      console.log(
        `Encrypted emergency #${emergency.id}`
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Make encrypted payload mandatory
    |--------------------------------------------------------------------------
    */

    await connection.execute(
      `ALTER TABLE emergency_events
       MODIFY COLUMN encrypted_payload LONGTEXT NOT NULL`
    );

    /*
    |--------------------------------------------------------------------------
    | Remove plaintext sensitive columns
    |--------------------------------------------------------------------------
    */

    await connection.execute(
      `ALTER TABLE emergency_events
       DROP COLUMN latitude,
       DROP COLUMN longitude,
       DROP COLUMN message`
    );

    console.log(
      "Plaintext emergency fields removed."
    );

    console.log(
      "Emergency-data encryption migration completed successfully."
    );
  } catch (error) {
    console.error(
      "Emergency-data encryption migration failed:",
      error
    );

    process.exitCode = 1;
  } finally {
    connection?.release();

    await pool.end();
  }
};

migrate();