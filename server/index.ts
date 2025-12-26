import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { clerkAuthMiddleware, requireAuthentication } from "./middleware/clerk";
import { DEV_SESSION_SECRET } from "./constants";

// TODO: Enable for production security (see SECURITY.md and PRODUCTION_DEPLOYMENT.md)
import { logEnvironmentValidation } from "./env-validation";
import { configureCors, validateCorsConfig } from "./middleware/cors";
import { apiLimiter, strictLimiter } from "./middleware/rate-limit";

// Validate environment on startup (uncomment for production)
// logEnvironmentValidation();

const app = express();
const httpServer = createServer(app);
const MemoryStore = createMemoryStore(session);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// TODO: Configure CORS for production (uncomment after installing cors package)
validateCorsConfig();
app.use(configureCors());

// TODO: Add request size limits for security (uncomment for production)
app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Routes that should be publicly accessible (no auth required)
const PUBLIC_ROUTES = [
  "/api/health",
  "/api/crm/salesforce/callback",
  "/api/email/gmail/callback",
  "/api/email/outlook/callback",
  "/api/stripe/webhook",
];

// Apply Clerk auth middleware globally (if configured)
if (process.env.CLERK_SECRET_KEY) {
  // First, add auth context to all requests
  app.use(clerkAuthMiddleware);
  
  // Then, enforce authentication on protected API routes
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    // Skip auth enforcement for public routes
    const fullPath = req.baseUrl + req.path;
    if (PUBLIC_ROUTES.some(route => fullPath.startsWith(route))) {
      return next();
    }
    // Require authentication for all other API routes
    return requireAuthentication(req, res, next);
  });
  
  console.log("[Auth] Clerk authentication enabled and enforced on API routes");
} else {
  // Enable lightweight session support in development to keep per-session context
  app.use(
    session({
      secret: DEV_SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86400000 }),
      cookie: {
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  console.log("[Auth] Clerk not configured - running without authentication (dev sessions enabled)");
}

// TODO: Add rate limiting for production (uncomment after installing express-rate-limit)
// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter());
// Apply strict rate limiting to expensive operations
app.use('/api/generate-email', strictLimiter());
app.use('/api/generate-emails-bulk', strictLimiter());
app.use('/api/detect-triggers', strictLimiter());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Initialize the app (register routes, setup static serving, etc.)
async function initializeApp() {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
}

// Initialize app immediately (synchronously start the async init)
// This ensures routes are registered before the app is exported
let initPromise: Promise<void> | null = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeApp().catch((err) => {
      console.error("Failed to initialize app:", err);
      throw err;
    });
  }
  return initPromise;
}

// Start initialization immediately
ensureInitialized();

// Check if we're running on Vercel
const isVercel = !!process.env.VERCEL;

if (!isVercel) {
  // Local development: wait for initialization and start the server
  (async () => {
    await ensureInitialized();

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 3000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "3000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        // reusePort: true, // uncomment this to enable port reuse
      },
      () => {
        log(`serving on port ${port}`);
        console.log(`view at http://localhost:${port}`);
      },
    );
  })();
}

// Export the app for Vercel serverless functions
// On Vercel, initialization will happen when the module is first loaded
// Vercel will wait for the promise to resolve before handling requests
export default app;
