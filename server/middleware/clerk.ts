import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction, RequestHandler } from "express";

// Explicitly configure Clerk with environment variables
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.CLERK_SECRET_KEY;

// Configure clerkMiddleware with explicit keys
export const clerkAuthMiddleware = clerkMiddleware({
  publishableKey: publishableKey,
  secretKey: secretKey,
});

export const requireAuthentication: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized", message: "Userid not found" });
    return;
  }
  
  next();
};

export function getCurrentUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth.userId;
}
