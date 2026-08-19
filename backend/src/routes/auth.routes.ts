import { Router } from "express";

import {
  register,
  login,
  getMe,
} from "../controllers/auth.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";

import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/

/*
 * Register a new user
 *
 * POST /api/auth/register
 */
router.post(
  "/register",
  register
);

/*
 * Login
 *
 * POST /api/auth/login
 */
router.post(
  "/login",
  login
);

/*
 * Get Current User
 *
 * GET /api/auth/me
 *
 * Returns the complete user profile:
 * - id
 * - name
 * - email
 * - role
 *
 * This allows the frontend to restore the
 * user's name after a page refresh.
 */
router.get(
  "/me",
  authenticateToken,
  getMe
);

/*
|--------------------------------------------------------------------------
| Responder Test
|--------------------------------------------------------------------------
|
| RESPONDER / ADMIN only
|
*/

router.get(
  "/responder-test",
  authenticateToken,
  requireRole(
    "RESPONDER",
    "ADMIN"
  ),
  (_req, res) => {
    res.json({
      message:
        "Responder access granted",
    });
  }
);

export default router;