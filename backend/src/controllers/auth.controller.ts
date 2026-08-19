import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import pool from "../config/database.js";

import {
  AuthenticatedRequest,
} from "../middleware/auth.middleware.js";

interface UserRecord {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: "USER" | "RESPONDER" | "ADMIN";
}

/*
|--------------------------------------------------------------------------
| Register
|--------------------------------------------------------------------------
|
| POST /api/auth/register
|
*/

export const register = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Validate Required Fields
    |--------------------------------------------------------------------------
    */

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Name, email, and password are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Password
    |--------------------------------------------------------------------------
    */

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Normalize Input
    |--------------------------------------------------------------------------
    */

    const normalizedName =
      String(name).trim();

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    if (
      !normalizedName ||
      !normalizedEmail
    ) {
      return res.status(400).json({
        message:
          "Name and email cannot be empty",
      });
    }

    if (
      normalizedName.length > 100
    ) {
      return res.status(400).json({
        message:
          "Name cannot exceed 100 characters",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Check Existing Email
    |--------------------------------------------------------------------------
    */

    const [existingUsers] =
      await pool.execute(
        "SELECT id FROM users WHERE email = ?",
        [normalizedEmail]
      );

    if (
      Array.isArray(existingUsers) &&
      existingUsers.length > 0
    ) {
      return res.status(409).json({
        message:
          "An account with this email already exists",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Hash Password
    |--------------------------------------------------------------------------
    */

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    /*
    |--------------------------------------------------------------------------
    | Insert User
    |--------------------------------------------------------------------------
    */

    const [result] =
      await pool.execute(
        `INSERT INTO users
         (
           name,
           email,
           password_hash
         )
         VALUES (?, ?, ?)`,
        [
          normalizedName,
          normalizedEmail,
          passwordHash,
        ]
      );

    const insertResult =
      result as {
        insertId: number;
      };

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({
      message:
        "User registered successfully",

      user: {
        id:
          insertResult.insertId,

        name:
          normalizedName,

        email:
          normalizedEmail,

        role: "USER",
      },
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return res.status(500).json({
      message:
        "Internal server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
|
| POST /api/auth/login
|
*/

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Validate Input
    |--------------------------------------------------------------------------
    */

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | Find User
    |--------------------------------------------------------------------------
    */

    const [rows] =
      await pool.execute(
        `SELECT
           id,
           name,
           email,
           password_hash,
           role
         FROM users
         WHERE email = ?`,
        [normalizedEmail]
      );

    const users =
      rows as UserRecord[];

    if (
      users.length === 0
    ) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const user =
      users[0];

    /*
    |--------------------------------------------------------------------------
    | Verify Password
    |--------------------------------------------------------------------------
    */

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | JWT Secret
    |--------------------------------------------------------------------------
    */

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error(
        "JWT_SECRET is not configured"
      );

      return res.status(500).json({
        message:
          "Authentication service is not configured",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Generate JWT
    |--------------------------------------------------------------------------
    */

    const token =
      jwt.sign(
        {
          userId: user.id,
          role: user.role,
        },
        jwtSecret,
        {
          expiresIn: "1h",
        }
      );

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      message:
        "Login successful",

      token,

      user: {
        id:
          user.id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      message:
        "Internal server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Current User
|--------------------------------------------------------------------------
|
| GET /api/auth/me
|
| Requires authentication.
|
| Returns the complete user profile so that
| the frontend can restore the user's name,
| email, ID and role after a page refresh.
|
*/

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | Authentication Check
    |--------------------------------------------------------------------------
    */

    if (!req.user) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Fetch Current User
    |--------------------------------------------------------------------------
    */

    const [rows] =
      await pool.execute(
        `SELECT
           id,
           name,
           email,
           role
         FROM users
         WHERE id = ?`,
        [req.user.userId]
      );

    const users =
      rows as Array<{
        id: number;
        name: string;
        email: string;
        role:
          | "USER"
          | "RESPONDER"
          | "ADMIN";
      }>;

    /*
    |--------------------------------------------------------------------------
    | User Not Found
    |--------------------------------------------------------------------------
    */

    if (
      users.length === 0
    ) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    const user =
      users[0];

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      message:
        "User retrieved successfully",

      user: {
        id:
          user.id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role,
      },
    });
  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to retrieve user",
    });
  }
};