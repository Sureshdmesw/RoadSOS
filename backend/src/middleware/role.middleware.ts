import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware.js";

type Role = "USER" | "RESPONDER" | "ADMIN";

export const requireRole = (...allowedRoles: Role[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };
};