import { Router } from "express";

import {
  createEmergency,
  getMyEmergencies,
  getActiveEmergencies,
  acknowledgeEmergency,
  resolveEmergency,
} from "../controllers/emergency.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| USER / RESPONDER / ADMIN
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Create Emergency
|--------------------------------------------------------------------------
|
| POST /api/emergencies
|
*/

router.post(
  "/",
  authenticateToken,
  requireRole("USER", "RESPONDER", "ADMIN"),
  createEmergency
);

/*
|--------------------------------------------------------------------------
| Get My Emergencies
|--------------------------------------------------------------------------
|
| GET /api/emergencies/my
|
*/

router.get(
  "/my",
  authenticateToken,
  requireRole("USER", "RESPONDER", "ADMIN"),
  getMyEmergencies
);

/*
|--------------------------------------------------------------------------
| RESPONDER / ADMIN
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Get Active Emergencies
|--------------------------------------------------------------------------
|
| GET /api/emergencies/active
|
*/

router.get(
  "/active",
  authenticateToken,
  requireRole("RESPONDER", "ADMIN"),
  getActiveEmergencies
);

/*
|--------------------------------------------------------------------------
| Acknowledge Emergency
|--------------------------------------------------------------------------
|
| PATCH /api/emergencies/:id/acknowledge
|
*/

router.patch(
  "/:id/acknowledge",
  authenticateToken,
  requireRole("RESPONDER", "ADMIN"),
  acknowledgeEmergency
);

/*
|--------------------------------------------------------------------------
| Resolve Emergency
|--------------------------------------------------------------------------
|
| PATCH /api/emergencies/:id/resolve
|
*/

router.patch(
  "/:id/resolve",
  authenticateToken,
  requireRole("RESPONDER", "ADMIN"),
  resolveEmergency
);

export default router;