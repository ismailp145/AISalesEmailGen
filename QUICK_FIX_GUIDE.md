# Quick Fix Guide - Critical Issues Only

This guide provides **copy-paste ready code** to fix the 12 most critical issues in ~4 hours.

---

## 🚀 Quick Start (30 minutes)

### Step 1: Install Required Dependencies

```bash
# Install all required packages at once
npm install express-rate-limit cors @types/cors connect-redis redis helmet dompurify @types/dompurify
```

### Step 2: Create .env.example File

Create `/Users/ismail/.cursor/worktrees/AISalesEmailGen/xeq/.env.example`:

```bash
# REQUIRED
DATABASE_URL=postgresql://user:password@host:5432/database
OPENAI_API_KEY=sk-...

# REQUIRED FOR PRODUCTION
NODE_ENV=production
PORT=3000
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
REDIS_URL=redis://localhost:6379

# AUTHENTICATION
CLERK_SECRET_KEY=sk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# PAYMENTS
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SECURITY
CORS_ORIGIN=https://yourdomain.com
ALLOWED_HOSTS=yourdomain.com

# OPTIONAL
SENDGRID_API_KEY=SG...
FIRECRAWL_API_KEY=fc-...
HUBSPOT_API_KEY=pat-na1-...
```

### Step 3: Generate SESSION_SECRET

```bash
# Run this command and copy the output to your .env file
openssl rand -base64 32
```

---

## 🔧 Fix 1: Enable Environment Validation (5 minutes)

**File:** `server/index.ts`

**Change lines 11-17 from:**
```typescript
// TODO: Enable for production security (see SECURITY.md and PRODUCTION_DEPLOYMENT.md)
// import { logEnvironmentValidation } from "./env-validation";
// import { configureCors, validateCorsConfig } from "./middleware/cors";
// import { apiLimiter, strictLimiter } from "./middleware/rate-limit";

// Validate environment on startup (uncomment for production)
// logEnvironmentValidation();
```

**To:**
```typescript
import { logEnvironmentValidation } from "./env-validation";
import { configureCors, validateCorsConfig } from "./middleware/cors";
import { apiLimiter, strictLimiter } from "./middleware/rate-limit";

// Validate environment on startup
logEnvironmentValidation();
```

---

## 🔧 Fix 2: Enable CORS (5 minutes)

**File:** `server/index.ts`

**Change lines 29-31 from:**
```typescript
// TODO: Configure CORS for production (uncomment after installing cors package)
// validateCorsConfig();
// app.use(configureCors());
```

**To:**
```typescript
// Configure CORS for production
validateCorsConfig();
app.use(configureCors());
```

**File:** `server/middleware/cors.ts`

**Uncomment the entire implementation** (lines 16-53). Replace the placeholder function with:

```typescript
import cors from 'cors';
import type { CorsOptions } from 'cors';

export function configureCors() {
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Dev-User-Id'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 600,
  };

  return cors(corsOptions);
}
```

---

## 🔧 Fix 3: Add Request Size Limits (2 minutes)

**File:** `server/index.ts`

**Change lines 33-45 from:**
```typescript
// TODO: Add request size limits for security (uncomment for production)
// app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
// app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
```

**To:**
```typescript
// Add request size limits for security
app.use(
  express.json({
    limit: '100kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
```

---

## 🔧 Fix 4: Enable Rate Limiting (5 minutes)

**File:** `server/index.ts`

**Change lines 91-97 from:**
```typescript
// TODO: Add rate limiting for production (uncomment after installing express-rate-limit)
// Apply general rate limiting to all API routes
// app.use('/api/', apiLimiter());
// Apply strict rate limiting to expensive operations
// app.use('/api/generate-email', strictLimiter());
// app.use('/api/generate-emails-bulk', strictLimiter());
// app.use('/api/detect-triggers', strictLimiter());
```

**To:**
```typescript
// Apply rate limiting
app.use('/api/', apiLimiter());
app.use('/api/generate-email', strictLimiter());
app.use('/api/generate-emails-bulk', strictLimiter());
app.use('/api/detect-triggers', strictLimiter());
```

**File:** `server/middleware/rate-limit.ts`

**Replace the entire file with:**

```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });
};

export const strictLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.STRICT_RATE_LIMIT_MAX || '20'),
    message: 'Too many generation requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many generation requests. Please try again in a few minutes.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });
};

export const authLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many failed authentication attempts. Please try again later.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });
};

export type RateLimitMiddleware = ReturnType<typeof apiLimiter>;
```

---

## 🔧 Fix 5: Redis Session Storage (15 minutes)

**File:** `server/index.ts`

**Add imports at the top:**
```typescript
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
```

**Replace lines 76-89 with:**
```typescript
// Configure session storage
if (process.env.CLERK_SECRET_KEY) {
  // Clerk handles authentication
  app.use(clerkAuthMiddleware);
  
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const fullPath = req.baseUrl + req.path;
    if (PUBLIC_ROUTES.some(route => fullPath.startsWith(route))) {
      return next();
    }
    return requireAuthentication(req, res, next);
  });
  
  console.log("[Auth] Clerk authentication enabled and enforced on API routes");
} else {
  // Development mode - use session storage
  const configureSessionStore = async () => {
    let sessionStore;
    
    if (process.env.REDIS_URL) {
      // Production: Use Redis
      const redisClient = createClient({
        url: process.env.REDIS_URL,
      });
      
      redisClient.on('error', (err) => console.error('Redis Client Error', err));
      await redisClient.connect();
      
      sessionStore = new RedisStore({ client: redisClient });
      console.log("[Session] Using Redis session store");
    } else {
      // Development: Use memory store
      const MemoryStore = createMemoryStore(session);
      sessionStore = new MemoryStore({ checkPeriod: 86400000 });
      console.log("[Session] Using memory session store (development only)");
    }
    
    app.use(
      session({
        store: sessionStore,
        secret: process.env.SESSION_SECRET || DEV_SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      }),
    );
  };
  
  // Initialize session store
  await configureSessionStore();
  
  console.log("[Auth] Clerk not configured - running with session-based auth");
}
```

**Update the async IIFE at the bottom** (around line 136):

Change from:
```typescript
(async () => {
  await registerRoutes(httpServer, app);
```

To:
```typescript
(async () => {
  // Session store is now configured above
  await registerRoutes(httpServer, app);
```

---

## 🔧 Fix 6: Sanitize Error Messages (20 minutes)

**File:** `server/routes.ts`

**Add at the top of the file (after imports):**

```typescript
/**
 * Sanitize error messages for production
 */
function sanitizeError(error: any): { message: string } {
  // Always log full error server-side
  console.error('[Error]', error);
  
  if (process.env.NODE_ENV === 'development') {
    return { message: error?.message || 'An error occurred' };
  }
  
  // Production: Generic messages only
  return { message: 'An unexpected error occurred. Please try again.' };
}
```

**Update all catch blocks** to use sanitizeError. Example:

**Find and replace pattern:**
```typescript
// OLD:
catch (error: any) {
  console.error("Email generation error:", error);
  return res.status(500).json({
    error: "Failed to generate email",
    message: error?.message || "An unexpected error occurred. Please try again.",
  });
}

// NEW:
catch (error: any) {
  return res.status(500).json({
    error: "Failed to generate email",
    ...sanitizeError(error),
  });
}
```

**Apply this pattern to all catch blocks in the file** (approximately 30 locations).

---

## 🔧 Fix 7: Fix Prospect Data Scoping (10 minutes)

**File:** `server/routes.ts`

**Update the `/api/prospects` endpoint (around line 1617):**

```typescript
app.get("/api/prospects", async (req, res) => {
  try {
    const userId = getUserIdOrDefault(req);
    const source = req.query.source as CrmProvider | undefined;
    
    let prospects;
    if (source) {
      prospects = await storage.getProspectsByCrmSource(userId, source);
    } else {
      prospects = await storage.getAllProspects(userId);
    }

    return res.json(prospects);
  } catch (error: any) {
    console.error("Get prospects error:", error);
    return res.status(500).json({
      error: "Failed to get prospects",
      ...sanitizeError(error),
    });
  }
});
```

**File:** `server/storage.ts`

**Update these methods (around lines 642-652):**

```typescript
async getProspectsByCrmSource(userId: string, source: CrmProvider): Promise<ProspectRecord[]> {
  return db.select()
    .from(prospects)
    .where(and(
      eq(prospects.userId, userId),
      eq(prospects.crmSource, source)
    ))
    .orderBy(desc(prospects.createdAt));
}

async getAllProspects(userId: string): Promise<ProspectRecord[]> {
  return db.select()
    .from(prospects)
    .where(eq(prospects.userId, userId))
    .orderBy(desc(prospects.createdAt));
}
```

**Update the interface (around line 108):**

```typescript
// Prospect database operations (for CRM sync)
saveProspects(prospects: InsertProspect[]): Promise<ProspectRecord[]>;
getProspectsByCrmSource(userId: string, source: CrmProvider): Promise<ProspectRecord[]>;
getAllProspects(userId: string): Promise<ProspectRecord[]>;
getProspectById(id: number): Promise<ProspectRecord | null>;
```

---

## 🔧 Fix 8: Validate OAuth Redirects (10 minutes)

**File:** `server/routes.ts`

**Update the `getBaseUrl` function (around line 83):**

```typescript
function getBaseUrl(req: any): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  
  // Validate against whitelist in production
  if (process.env.NODE_ENV === 'production') {
    const allowedHosts = process.env.ALLOWED_HOSTS?.split(',') || [];
    if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
      console.error(`[Security] Invalid host attempted: ${host}`);
      throw new Error('Invalid host');
    }
  }
  
  return `${protocol}://${host}`;
}
```

---

## 🔧 Fix 9: Require Clerk in Production (5 minutes)

**File:** `server/env-validation.ts`

**Add to PRODUCTION_VARS array (around line 45):**

```typescript
const PRODUCTION_VARS = [
  'SESSION_SECRET',
  'NODE_ENV',
  'CLERK_SECRET_KEY',  // Add this line
  'VITE_CLERK_PUBLISHABLE_KEY',  // Add this line
] as const;
```

**Add validation in validateEnvironment function (around line 80):**

```typescript
// Production-specific checks
if (isProduction) {
  for (const varName of PRODUCTION_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required production variable: ${varName}`);
    }
  }

  // Check session secret strength
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret && sessionSecret.length < 32) {
    warnings.push('SESSION_SECRET should be at least 32 characters for security');
  }
  
  // Require authentication in production
  if (!process.env.CLERK_SECRET_KEY) {
    errors.push('CLERK_SECRET_KEY is required in production for security');
  }

  // ... rest of validation
}
```

---

## 🔧 Fix 10: Add Security Headers (5 minutes)

**File:** `server/index.ts`

**Add import at top:**
```typescript
import helmet from 'helmet';
```

**Add after CORS configuration (around line 35):**

```typescript
// Add security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://openrouter.ai"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

---

## 🔧 Fix 11: Graceful Shutdown (5 minutes)

**File:** `server/index.ts`

**Add at the very end of the file (after the server starts):**

```typescript
// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  
  // Stop scheduler
  const { stopScheduler } = await import('./scheduler');
  stopScheduler();
  
  // Close server
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  
  // Stop scheduler
  const { stopScheduler } = await import('./scheduler');
  stopScheduler();
  
  // Close server
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});
```

---

## 🔧 Fix 12: Webhook Replay Protection (15 minutes)

**File:** `shared/schema.ts`

**Add new table definition (around line 106, after crmConnections):**

```typescript
// Processed webhooks table - prevent replay attacks
export const processedWebhooks = pgTable("processed_webhooks", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});
```

**File:** `server/storage.ts`

**Add to IStorage interface (around line 147):**

```typescript
// Webhook operations
isWebhookProcessed(eventId: string): Promise<boolean>;
markWebhookProcessed(eventId: string, eventType: string): Promise<void>;
```

**Add to DatabaseStorage class (at the end):**

```typescript
// ============================================
// Webhook Operations
// ============================================

async isWebhookProcessed(eventId: string): Promise<boolean> {
  const [result] = await db.select()
    .from(processedWebhooks)
    .where(eq(processedWebhooks.eventId, eventId))
    .limit(1);
  
  return !!result;
}

async markWebhookProcessed(eventId: string, eventType: string): Promise<void> {
  await db.insert(processedWebhooks).values({
    eventId,
    eventType,
  });
}
```

**File:** `server/routes.ts`

**Update Stripe webhook handler (around line 2102):**

```typescript
app.post("/api/stripe/webhook", async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"] as string;
    
    if (!signature) {
      console.error('[Stripe Webhook] Missing signature');
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error('[Stripe Webhook] Missing rawBody');
      return res.status(400).json({ error: "Raw body not available" });
    }

    const event = constructWebhookEvent(rawBody, signature);
    
    // Check for replay attack
    const isProcessed = await storage.isWebhookProcessed(event.id);
    if (isProcessed) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, ignoring`);
      return res.json({ received: true, message: 'Already processed' });
    }
    
    const result = await handleWebhookEvent(event);

    console.log(`[Stripe Webhook] Event: ${event.type}, Action: ${result.action}`);

    if (result.action !== "ignored" && result.userId) {
      switch (result.action) {
        case "subscription_created":
        case "subscription_updated":
          await storage.updateSubscriptionTier(result.userId, result.tier || "pro", {
            customerId: result.customerId,
            subscriptionId: result.subscriptionId,
            startsAt: new Date(),
            endsAt: result.currentPeriodEnd,
          });
          console.log(`[Stripe Webhook] Updated subscription for user ${result.userId} to ${result.tier}`);
          break;
          
        case "subscription_deleted":
          await storage.updateSubscriptionTier(result.userId, "free", {
            customerId: result.customerId,
            subscriptionId: undefined,
          });
          console.log(`[Stripe Webhook] Cancelled subscription for user ${result.userId}`);
          break;
          
        case "payment_failed":
          console.log(`[Stripe Webhook] Payment failed for user ${result.userId}`);
          break;
      }
    }
    
    // Mark as processed
    await storage.markWebhookProcessed(event.id, event.type);

    return res.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return res.status(400).json({
      error: "Webhook error",
      message: "Failed to process webhook",
    });
  }
});
```

**Run database migration:**

```bash
npm run db:push
```

---

## ✅ Verification Checklist

After implementing all fixes:

- [ ] Run `npm install` to ensure all dependencies are installed
- [ ] Create `.env` file with all required variables
- [ ] Generate SESSION_SECRET with `openssl rand -base64 32`
- [ ] Set up Redis (or use Upstash free tier)
- [ ] Run `npm run db:push` to apply schema changes
- [ ] Run `npm run check` to verify TypeScript compilation
- [ ] Test in development: `npm run dev`
- [ ] Verify environment validation runs on startup
- [ ] Test rate limiting with multiple requests
- [ ] Test CORS with different origins
- [ ] Deploy to staging environment
- [ ] Run security audit: `npm audit`
- [ ] Test all critical user flows

---

## 🚨 Before Production Deployment

1. **Set up Redis:**
   - Option 1: [Upstash](https://upstash.com/) (Free tier available)
   - Option 2: [Redis Cloud](https://redis.com/try-free/)
   - Option 3: Self-hosted Redis

2. **Configure Environment Variables:**
   ```bash
   # Generate strong secret
   SESSION_SECRET=$(openssl rand -base64 32)
   
   # Set in your hosting platform
   REDIS_URL=redis://...
   CORS_ORIGIN=https://yourdomain.com
   ALLOWED_HOSTS=yourdomain.com
   NODE_ENV=production
   ```

3. **Test Everything:**
   - Sign up flow
   - Email generation
   - Subscription upgrade
   - Stripe webhooks
   - OAuth integrations

4. **Monitor:**
   - Set up error tracking (Sentry)
   - Configure uptime monitoring
   - Watch logs for first 24 hours

---

## 📞 Need Help?

If you encounter issues:

1. Check the logs for error messages
2. Verify all environment variables are set
3. Ensure Redis is accessible
4. Test database connectivity
5. Review the full audit: `PRODUCTION_READINESS_AUDIT.md`

**Estimated Total Time: 4-6 hours**

Good luck! 🚀

