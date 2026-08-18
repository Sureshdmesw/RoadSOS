import { Router } from "express";
import { requireRole } from "../middleware/role.middleware.js";

import {
  register,
  login,
} from "../controllers/auth.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/me", authenticateToken, (req, res) => {
  res.json({
    message: "Authentication successful",
    user: req.user,
  });
});

router.get(
  "/responder-test",
  authenticateToken,
  requireRole("RESPONDER", "ADMIN"),
  (_req, res) => {
    res.json({
      message: "Responder access granted",
    });
  }
);

export default router;