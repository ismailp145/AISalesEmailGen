import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction, RequestHandler } from "express";

export const clerkAuthMiddleware = clerkMiddleware();

export const requireAuthentication: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  
  next();
};

export function getCurrentUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth.userId;
}
