import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import pool from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";
import emergencyRoutes from "./routes/emergency.routes.js";

// Load environment variables
dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT) || 5000;

/*
|--------------------------------------------------------------------------
| Security Middleware
|--------------------------------------------------------------------------
*/

// Security-related HTTP headers
app.use(helmet());

// Allow requests from the configured RoadSOS frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse JSON request bodies
app.use(
  express.json({
    limit: "10kb",
  })
);

/*
|--------------------------------------------------------------------------
| API Rate Limiting
|--------------------------------------------------------------------------
*/

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

/*
|--------------------------------------------------------------------------
| Basic Health Check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "RoadSOS API",
  });
});

/*
|--------------------------------------------------------------------------
| Database Health Check
|--------------------------------------------------------------------------
*/

app.get("/api/health/db", async (_req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.ping();

    res.status(200).json({
      status: "ok",
      database: "MySQL",
      connected: true,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      database: "MySQL",
      connected: false,
    });
  } finally {
    connection?.release();
  }
});

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
|
| POST /api/auth/register
| POST /api/auth/login
| GET  /api/auth/me
| GET  /api/auth/responder-test
|
*/

app.use("/api/auth", authRoutes);

/*
|--------------------------------------------------------------------------
| Emergency Routes
|--------------------------------------------------------------------------
|
| POST /api/emergencies
|
| Authentication and role authorization
| are handled inside emergency.routes.ts.
|
*/

app.use("/api/emergencies", emergencyRoutes);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled server error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
);

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`RoadSOS API running on port ${PORT}`);
});