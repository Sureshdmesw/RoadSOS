import { Response } from "express";

import pool from "../config/database.js";

import {
  encryptData,
  decryptData,
} from "../utils/encryption.js";

import {
  AuthenticatedRequest,
} from "../middleware/auth.middleware.js";

interface EmergencyPayload {
  latitude: number;
  longitude: number;
  message: string | null;
}

interface EmergencyDatabaseRow {
  id: number;
  user_id: number;
  emergency_type: string;
  encrypted_payload: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  created_at: string;
  acknowledged_at: string | null;
}

/*
|--------------------------------------------------------------------------
| Create Emergency
|--------------------------------------------------------------------------
|
| POST /api/emergencies
|
*/

export const createEmergency = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  let connection;

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const {
      emergencyType,
      latitude,
      longitude,
      message,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Validate Required Fields
    |--------------------------------------------------------------------------
    */

    if (
      typeof emergencyType !== "string" ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        message:
          "Emergency type, latitude, and longitude are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Emergency Type
    |--------------------------------------------------------------------------
    */

    const normalizedEmergencyType =
      emergencyType
        .trim()
        .toUpperCase();

    const allowedEmergencyTypes = [
      "ACCIDENT",
      "MEDICAL",
      "BREAKDOWN",
      "OTHER",
    ];

    if (
      !allowedEmergencyTypes.includes(
        normalizedEmergencyType
      )
    ) {
      return res.status(400).json({
        message: "Invalid emergency type",
        allowedTypes:
          allowedEmergencyTypes,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate GPS
    |--------------------------------------------------------------------------
    */

    const parsedLatitude =
      Number(latitude);

    const parsedLongitude =
      Number(longitude);

    if (
      !Number.isFinite(
        parsedLatitude
      ) ||
      !Number.isFinite(
        parsedLongitude
      )
    ) {
      return res.status(400).json({
        message:
          "Latitude and longitude must be valid numbers",
      });
    }

    if (
      parsedLatitude < -90 ||
      parsedLatitude > 90
    ) {
      return res.status(400).json({
        message:
          "Latitude must be between -90 and 90",
      });
    }

    if (
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      return res.status(400).json({
        message:
          "Longitude must be between -180 and 180",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Message
    |--------------------------------------------------------------------------
    */

    let normalizedMessage:
      | string
      | null = null;

    if (
      message !== undefined &&
      message !== null
    ) {
      if (
        typeof message !== "string"
      ) {
        return res.status(400).json({
          message:
            "Emergency message must be a string",
        });
      }

      normalizedMessage =
        message.trim();

      if (
        normalizedMessage.length > 500
      ) {
        return res.status(400).json({
          message:
            "Emergency message cannot exceed 500 characters",
        });
      }

      if (
        normalizedMessage.length === 0
      ) {
        normalizedMessage = null;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Build Sensitive Payload
    |--------------------------------------------------------------------------
    */

    const sensitivePayload: EmergencyPayload =
      {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        message: normalizedMessage,
      };

    /*
    |--------------------------------------------------------------------------
    | AES-256-GCM Encryption
    |--------------------------------------------------------------------------
    */

    const encryptedPayload =
      encryptData(
        sensitivePayload
      );

    /*
    |--------------------------------------------------------------------------
    | Database Transaction
    |--------------------------------------------------------------------------
    */

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | Store Encrypted Emergency
    |--------------------------------------------------------------------------
    |
    | SECURITY:
    |
    | The sensitive GPS/message payload is
    | encrypted BEFORE reaching MySQL.
    |
    */

    const [result] =
      await connection.execute(
        `INSERT INTO emergency_events
         (
           user_id,
           emergency_type,
           encrypted_payload
         )
         VALUES (?, ?, ?)`,
        [
          req.user.userId,
          normalizedEmergencyType,
          encryptedPayload,
        ]
      );

    const insertResult =
      result as {
        insertId: number;
      };

    /*
    |--------------------------------------------------------------------------
    | Audit Log
    |--------------------------------------------------------------------------
    */

    await connection.execute(
      `INSERT INTO audit_logs
       (
         user_id,
         action,
         ip_address
       )
       VALUES (?, ?, ?)`,
      [
        req.user.userId,
        `CREATE_EMERGENCY:${insertResult.insertId}`,
        req.ip || null,
      ]
    );

    await connection.commit();

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({
      message:
        "Emergency created successfully",

      emergency: {
        id: insertResult.insertId,
        userId:
          req.user.userId,
        emergencyType:
          normalizedEmergencyType,
        latitude:
          parsedLatitude,
        longitude:
          parsedLongitude,
        message:
          normalizedMessage,
        status: "ACTIVE",
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Transaction rollback failed:",
          rollbackError
        );
      }
    }

    console.error(
      "Emergency creation error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to create emergency",
    });
  } finally {
    connection?.release();
  }
};

/*
|--------------------------------------------------------------------------
| Get My Emergencies
|--------------------------------------------------------------------------
|
| GET /api/emergencies/my
|
*/

export const getMyEmergencies = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }

    const [rows] =
      await pool.execute(
        `SELECT
           id,
           user_id,
           emergency_type,
           encrypted_payload,
           status,
           created_at,
           acknowledged_at
         FROM emergency_events
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.user.userId]
      );

    const emergencies =
      rows as EmergencyDatabaseRow[];

    const decryptedEmergencies =
      emergencies.map(
        (emergency) => {
          const payload =
            decryptData<EmergencyPayload>(
              emergency.encrypted_payload
            );

          return {
            id: emergency.id,

            user_id:
              emergency.user_id,

            emergency_type:
              emergency.emergency_type,

            latitude:
              payload.latitude,

            longitude:
              payload.longitude,

            message:
              payload.message,

            status:
              emergency.status,

            created_at:
              emergency.created_at,

            acknowledged_at:
              emergency.acknowledged_at,
          };
        }
      );

    return res.status(200).json({
      emergencies:
        decryptedEmergencies,
    });
  } catch (error) {
    console.error(
      "Fetch user emergencies error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to fetch emergencies",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Active Emergencies
|--------------------------------------------------------------------------
|
| GET /api/emergencies/active
|
| RESPONDER / ADMIN only
|
*/

export const getActiveEmergencies =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message:
            "Authentication required",
        });
      }

      const [rows] =
        await pool.execute(
          `SELECT
             e.id,
             e.user_id,
             u.name AS user_name,
             e.emergency_type,
             e.encrypted_payload,
             e.status,
             e.created_at,
             e.acknowledged_at
           FROM emergency_events e
           LEFT JOIN users u
             ON e.user_id = u.id
           WHERE e.status = 'ACTIVE'
           ORDER BY e.created_at ASC`
        );

      const emergencies =
        rows as EmergencyDatabaseRow[];

      const decryptedEmergencies =
        emergencies.map(
          (emergency) => {
            const payload =
              decryptData<EmergencyPayload>(
                emergency.encrypted_payload
              );

            return {
              id: emergency.id,

              user_id:
                emergency.user_id,

              user_name:
                (
                  emergency as EmergencyDatabaseRow & {
                    user_name?: string;
                  }
                ).user_name,

              emergency_type:
                emergency.emergency_type,

              latitude:
                payload.latitude,

              longitude:
                payload.longitude,

              message:
                payload.message,

              status:
                emergency.status,

              created_at:
                emergency.created_at,

              acknowledged_at:
                emergency.acknowledged_at,
            };
          }
        );

      return res.status(200).json({
        emergencies:
          decryptedEmergencies,
      });
    } catch (error) {
      console.error(
        "Fetch active emergencies error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to fetch active emergencies",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Acknowledge Emergency
|--------------------------------------------------------------------------
*/

export const acknowledgeEmergency =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    let connection;

    try {
      if (!req.user) {
        return res.status(401).json({
          message:
            "Authentication required",
        });
      }

      const emergencyId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          emergencyId
        ) ||
        emergencyId <= 0
      ) {
        return res.status(400).json({
          message:
            "Invalid emergency ID",
        });
      }

      connection =
        await pool.getConnection();

      await connection.beginTransaction();

      const [rows] =
        await connection.execute(
          `SELECT
             id,
             status
           FROM emergency_events
           WHERE id = ?
           FOR UPDATE`,
          [emergencyId]
        );

      const emergencies =
        rows as Array<{
          id: number;
          status:
            | "ACTIVE"
            | "ACKNOWLEDGED"
            | "RESOLVED";
        }>;

      if (
        emergencies.length === 0
      ) {
        await connection.rollback();

        return res.status(404).json({
          message:
            "Emergency not found",
        });
      }

      if (
        emergencies[0].status !==
        "ACTIVE"
      ) {
        await connection.rollback();

        return res.status(409).json({
          message:
            `Emergency is already ${emergencies[0].status.toLowerCase()}`,
        });
      }

      await connection.execute(
        `UPDATE emergency_events
         SET
           status = 'ACKNOWLEDGED',
           acknowledged_at =
             CURRENT_TIMESTAMP
         WHERE id = ?`,
        [emergencyId]
      );

      await connection.execute(
        `INSERT INTO audit_logs
         (
           user_id,
           action,
           ip_address
         )
         VALUES (?, ?, ?)`,
        [
          req.user.userId,
          `ACKNOWLEDGE_EMERGENCY:${emergencyId}`,
          req.ip || null,
        ]
      );

      await connection.commit();

      return res.status(200).json({
        message:
          "Emergency acknowledged successfully",

        emergency: {
          id: emergencyId,
          status:
            "ACKNOWLEDGED",
        },
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Transaction rollback failed:",
            rollbackError
          );
        }
      }

      console.error(
        "Acknowledge emergency error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to acknowledge emergency",
      });
    } finally {
      connection?.release();
    }
  };

/*
|--------------------------------------------------------------------------
| Resolve Emergency
|--------------------------------------------------------------------------
*/

export const resolveEmergency =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    let connection;

    try {
      if (!req.user) {
        return res.status(401).json({
          message:
            "Authentication required",
        });
      }

      const emergencyId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          emergencyId
        ) ||
        emergencyId <= 0
      ) {
        return res.status(400).json({
          message:
            "Invalid emergency ID",
        });
      }

      connection =
        await pool.getConnection();

      await connection.beginTransaction();

      const [rows] =
        await connection.execute(
          `SELECT
             id,
             status
           FROM emergency_events
           WHERE id = ?
           FOR UPDATE`,
          [emergencyId]
        );

      const emergencies =
        rows as Array<{
          id: number;
          status:
            | "ACTIVE"
            | "ACKNOWLEDGED"
            | "RESOLVED";
        }>;

      if (
        emergencies.length === 0
      ) {
        await connection.rollback();

        return res.status(404).json({
          message:
            "Emergency not found",
        });
      }

      if (
        emergencies[0].status !==
        "ACKNOWLEDGED"
      ) {
        await connection.rollback();

        return res.status(409).json({
          message:
            "Only acknowledged emergencies can be resolved",
        });
      }

      await connection.execute(
        `UPDATE emergency_events
         SET status = 'RESOLVED'
         WHERE id = ?`,
        [emergencyId]
      );

      await connection.execute(
        `INSERT INTO audit_logs
         (
           user_id,
           action,
           ip_address
         )
         VALUES (?, ?, ?)`,
        [
          req.user.userId,
          `RESOLVE_EMERGENCY:${emergencyId}`,
          req.ip || null,
        ]
      );

      await connection.commit();

      return res.status(200).json({
        message:
          "Emergency resolved successfully",

        emergency: {
          id: emergencyId,
          status: "RESOLVED",
        },
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Transaction rollback failed:",
            rollbackError
          );
        }
      }

      console.error(
        "Resolve emergency error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to resolve emergency",
      });
    } finally {
      connection?.release();
    }
  };