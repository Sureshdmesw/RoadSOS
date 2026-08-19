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
  resolved_at: string | null;
}

interface EmergencyWithUser
  extends EmergencyDatabaseRow {
  user_name?: string;
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
      emergencyType.trim().toUpperCase();

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

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (
      !Number.isFinite(parsedLatitude) ||
      !Number.isFinite(parsedLongitude)
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
      if (typeof message !== "string") {
        return res.status(400).json({
          message:
            "Emergency message must be a string",
        });
      }

      normalizedMessage = message.trim();

      if (normalizedMessage.length > 500) {
        return res.status(400).json({
          message:
            "Emergency message cannot exceed 500 characters",
        });
      }

      if (normalizedMessage.length === 0) {
        normalizedMessage = null;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Build Sensitive Payload
    |--------------------------------------------------------------------------
    */

    const sensitivePayload: EmergencyPayload = {
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
      encryptData(sensitivePayload);

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
    | Sensitive GPS/message data is encrypted
    | before being stored in MySQL.
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

export const getMyEmergencies =
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
             id,
             user_id,
             emergency_type,
             encrypted_payload,
             status,
             created_at,
             acknowledged_at,
             resolved_at
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

              resolved_at:
                emergency.resolved_at,
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
| Get Active / Acknowledged Emergencies
|--------------------------------------------------------------------------
|
| GET /api/emergencies/active
|
| RESPONDER / ADMIN only
|
| Returns:
|   ACTIVE
|   ACKNOWLEDGED
|
| Does NOT return:
|   RESOLVED
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
             e.acknowledged_at,
             e.resolved_at
           FROM emergency_events e
           LEFT JOIN users u
             ON e.user_id = u.id
           WHERE e.status IN ('ACTIVE', 'ACKNOWLEDGED')
           ORDER BY e.created_at ASC`
        );

      const emergencies =
        rows as EmergencyWithUser[];

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
                emergency.user_name,

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

              resolved_at:
                emergency.resolved_at,
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
|
| ACTIVE → ACKNOWLEDGED
|
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
        !Number.isInteger(emergencyId) ||
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

      /*
      |--------------------------------------------------------------------------
      | Lock Emergency Row
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | Emergency Not Found
      |--------------------------------------------------------------------------
      */

      if (emergencies.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          message:
            "Emergency not found",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | State Validation
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | Update Status
      |--------------------------------------------------------------------------
      */

      await connection.execute(
        `UPDATE emergency_events
         SET
           status = 'ACKNOWLEDGED',
           acknowledged_at =
             CURRENT_TIMESTAMP
         WHERE id = ?`,
        [emergencyId]
      );

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
|
| ACKNOWLEDGED → RESOLVED
|
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
        !Number.isInteger(emergencyId) ||
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

      /*
      |--------------------------------------------------------------------------
      | Lock Emergency Row
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | Emergency Not Found
      |--------------------------------------------------------------------------
      */

      if (emergencies.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          message:
            "Emergency not found",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | State Validation
      |--------------------------------------------------------------------------
      |
      | Only ACKNOWLEDGED emergencies
      | can be resolved.
      |
      */

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

      /*
      |--------------------------------------------------------------------------
      | Mark Emergency as Resolved
      |--------------------------------------------------------------------------
      */

      await connection.execute(
        `UPDATE emergency_events
         SET
           status = 'RESOLVED',
           resolved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [emergencyId]
      );

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
          `RESOLVE_EMERGENCY:${emergencyId}`,
          req.ip || null,
        ]
      );

      await connection.commit();

      /*
      |--------------------------------------------------------------------------
      | Response
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        message:
          "Emergency resolved successfully",

        emergency: {
          id: emergencyId,
          status:
            "RESOLVED",
          resolved_at:
            new Date().toISOString(),
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