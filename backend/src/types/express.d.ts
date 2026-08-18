import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        role: "USER" | "RESPONDER" | "ADMIN";
      };
    }
  }
}

export {};