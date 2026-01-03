import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction, RequestHandler } from "express";

// Explicitly configure Clerk with environment variables
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.CLERK_SECRET_KEY;

// Log Clerk configuration status on startup
if (secretKey) {
  console.log("[Clerk] Configured with secret key:", secretKey.substring(0, 10) + "...");
} else {
  console.warn("[Clerk] WARNING: No CLERK_SECRET_KEY found - authentication will not work");
}

// Configure clerkMiddleware with explicit keys
export const clerkAuthMiddleware = clerkMiddleware({
  publishableKey: publishableKey,
  secretKey: secretKey,
});

export const requireAuthentication: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  
  // Debug logging for authentication issues
  const authHeader = req.headers.authorization;
  const hasCookies = !!req.headers.cookie;
  
  console.log(`[Auth Debug] ${req.method} ${req.path}`);
  console.log(`[Auth Debug] Authorization header: ${authHeader ? 'present' : 'missing'}`);
  console.log(`[Auth Debug] Cookies: ${hasCookies ? 'present' : 'missing'}`);
  console.log(`[Auth Debug] User ID from getAuth: ${auth.userId || 'null'}`);
  
  if (!auth.userId) {
    console.warn(`[Auth] Unauthorized request to ${req.path} - no userId found`);
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "Authentication required. Please sign in.",
      debug: {
        hasAuthHeader: !!authHeader,
        hasCookies: hasCookies,
      }
    });
    return;
  }
  
  console.log(`[Auth] Authenticated user: ${auth.userId}`);
  next();
};

export function getCurrentUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth.userId;
}
