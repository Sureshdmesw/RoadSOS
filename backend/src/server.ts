import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import pool from "./config/database.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Allow requests from our React frontend
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

// Parse JSON request bodies
app.use(express.json());

// Basic rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "RoadSOS API",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const connection = await pool.getConnection();

    await connection.ping();
    connection.release();

    res.json({
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
  }
});

app.listen(PORT, () => {
  console.log(`RoadSOS API running on http://localhost:${PORT}`);
});