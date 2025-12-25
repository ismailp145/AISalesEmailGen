# Security Best Practices

This document outlines critical security considerations and best practices for the AI Sales Email Generator.

## Critical Security Issues Addressed

### 1. ✅ API Keys and Secrets

**Status**: Properly implemented
- All API keys stored server-side in environment variables
- No secrets exposed in client-side code
- Keys loaded from `.env` file (which is gitignored)
- Never commit `.env` to source control

**Verification**:
```bash
# Check that .env is in .gitignore
grep .env .gitignore

# Verify no secrets in client code
grep -r "sk-" client/src/
grep -r "API_KEY" client/src/
```

### 2. ✅ User Data Isolation

**Status**: Properly implemented
- All database queries filtered by `userId`
- Prospects, emails, and sequences scoped to authenticated user
- Session-scoped IDs for unauthenticated users (dev mode only)

**Verification**: Review these files
- `server/storage.ts` - All queries include userId filter
- `server/routes.ts` - getUserIdOrDefault() used consistently

### 3. ⚠️ Rate Limiting

**Status**: TO BE IMPLEMENTED
**Risk**: Without rate limiting, API endpoints can be abused

**Implementation Required**:
```typescript
// TODO: Add to server/index.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to all routes
app.use('/api/', limiter);

// Stricter limit for expensive operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

app.use('/api/generate-email', strictLimiter);
app.use('/api/generate-emails-bulk', strictLimiter);
app.use('/api/detect-triggers', strictLimiter);
```

### 4. ⚠️ Request Size Limits

**Status**: PARTIAL - Need explicit limits
**Risk**: Large payloads can cause memory issues or DoS

**Implementation Required**:
```typescript
// TODO: Add to server/index.ts
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// For webhook endpoints that need raw body
app.use('/api/stripe/webhook', express.raw({ 
  type: 'application/json',
  limit: '1mb' 
}));
```

### 5. ⚠️ CORS Configuration

**Status**: TO BE CONFIGURED FOR PRODUCTION
**Risk**: Without proper CORS, API accessible from any domain

**Implementation Required**:
```typescript
// TODO: Add to server/index.ts
import cors from 'cors';

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

### 6. ✅ Subscription Limits Enforcement

**Status**: Properly implemented
- Email generation checks limits before processing
- Free trial system prevents abuse
- Usage tracked per user in database

**Verification**: 
- See `server/routes.ts` - `/api/generate-email` endpoint
- See `server/storage.ts` - `checkEmailLimit()` and `incrementEmailUsage()`

### 7. ⚠️ Session Storage

**Status**: MEMORY STORE (Not production-ready)
**Risk**: Sessions lost on restart, doesn't scale horizontally

**Current State** (in `server/index.ts`):
```typescript
// ⚠️ DEVELOPMENT ONLY - not suitable for production
import MemoryStore from 'memorystore';
const MemStore = MemoryStore(session);

app.use(session({
  store: new MemStore({
    checkPeriod: 86400000 // 24 hours
  }),
  // ...
}));
```

**Required for Production**:
```typescript
// Option 1: Redis (Recommended)
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});
redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  }
}));

// Option 2: PostgreSQL
import pgSession from 'connect-pg-simple';
const PostgresStore = pgSession(session);

app.use(session({
  store: new PostgresStore({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
  }),
  // ... same session config as above
}));
```

### 8. ✅ Input Validation

**Status**: Properly implemented
- All API endpoints use Zod schemas for validation
- Type-safe validation with TypeScript
- Sanitization handled by validation schemas

**Verification**:
- See `shared/schema.ts` - All request schemas defined
- See `server/routes.ts` - `.safeParse()` used for all inputs

### 9. ⚠️ Error Handling

**Status**: NEEDS IMPROVEMENT
**Risk**: Stack traces may expose sensitive information

**Current Issues**:
```typescript
// ⚠️ This may expose stack traces
catch (error: any) {
  return res.status(500).json({
    error: "Failed to generate email",
    message: error?.message // Could leak internal details
  });
}
```

**Implementation Required**:
```typescript
// TODO: Add centralized error handler
function sanitizeError(error: any, isDevelopment: boolean) {
  if (isDevelopment) {
    return {
      message: error?.message || 'An error occurred',
      stack: error?.stack,
    };
  }
  
  // Production: Never expose stack traces
  return {
    message: 'An unexpected error occurred. Please try again.',
  };
}

// Use in error handlers
catch (error: any) {
  console.error('Email generation error:', error); // Log full error server-side
  
  return res.status(500).json({
    error: "Failed to generate email",
    ...sanitizeError(error, process.env.NODE_ENV === 'development')
  });
}
```

### 10. ⚠️ Database Connection Security

**Status**: NEEDS POOL CONFIGURATION
**Risk**: Connection exhaustion under load

**Implementation Required**:
```typescript
// TODO: Add to server/db.ts
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Security Checklist for Production

### Pre-Deployment

- [ ] All API keys are production keys (not test keys)
- [ ] `.env` file is in `.gitignore` (verify with `git status`)
- [ ] No hardcoded secrets in code
- [ ] `SESSION_SECRET` is strong (32+ characters, random)
- [ ] Stripe webhook secret matches production webhook
- [ ] Database URL uses SSL connection
- [ ] HTTPS enabled with valid SSL certificate

### Runtime Security

- [ ] Rate limiting configured and tested
- [ ] Request size limits set appropriately
- [ ] CORS configured with allowed origins only
- [ ] Session storage uses Redis or PostgreSQL (not memory)
- [ ] Database connection pooling configured
- [ ] Error messages don't expose internals
- [ ] All user inputs validated with Zod schemas
- [ ] File upload size limits configured (if applicable)

### Authentication & Authorization

- [ ] Clerk properly configured with production keys
- [ ] All protected routes check authentication
- [ ] User data isolated by userId
- [ ] Session cookies set with `secure: true` in production
- [ ] Session cookies set with `httpOnly: true`
- [ ] JWT signing keys are strong (if using JWTs)

### Data Protection

- [ ] Database credentials stored securely
- [ ] Database access restricted to application IP only
- [ ] Sensitive data encrypted at rest (database level)
- [ ] Sensitive data encrypted in transit (HTTPS/TLS)
- [ ] User passwords never stored (Clerk handles this)
- [ ] API responses don't include sensitive internal data

### Monitoring & Logging

- [ ] Error logging configured (but not exposed to clients)
- [ ] Failed login attempts monitored
- [ ] Unusual API usage patterns monitored
- [ ] Database connection errors logged
- [ ] Stripe webhook failures logged
- [ ] Security alerts configured

### Dependency Security

- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Keep dependencies up to date
- [ ] Use `npm ci` for production builds (not `npm install`)
- [ ] Review dependency licenses
- [ ] Audit new dependencies before adding

### Stripe Security

- [ ] Using live keys (not test keys) in production
- [ ] Webhook signature verification enabled
- [ ] Customer metadata includes userId
- [ ] Subscription status validated server-side
- [ ] Payment intents validated before fulfillment

### Third-Party APIs

- [ ] OpenAI API key has spending limits set
- [ ] SendGrid sender domain verified
- [ ] FireCrawl API key has reasonable limits
- [ ] HubSpot/CRM OAuth tokens stored securely
- [ ] All API keys can be rotated if compromised

## Ongoing Security Maintenance

### Weekly
- Review error logs for security issues
- Check for unusual API usage patterns
- Monitor failed authentication attempts

### Monthly
- Review and update dependencies: `npm outdated`
- Run security audit: `npm audit`
- Review access logs for suspicious activity
- Test backup and recovery procedures

### Quarterly
- Rotate API keys (especially if team members leave)
- Review and update security policies
- Penetration testing (consider hiring security firm)
- Review user permissions and access controls

### Annually
- Comprehensive security audit
- Update disaster recovery plan
- Review and update security documentation
- Security training for development team

## Common Vulnerabilities to Avoid

### ❌ Never Do This

```typescript
// ❌ DON'T: Expose API keys in client code
const openaiKey = "sk-..."; // Never!

// ❌ DON'T: Trust client-side data without validation
app.post('/api/generate-email', (req, res) => {
  const userId = req.body.userId; // Never trust this!
});

// ❌ DON'T: Include stack traces in production errors
res.status(500).json({ error: error.stack }); // Never in production!

// ❌ DON'T: Use weak session secrets
app.use(session({ secret: '123' })); // Way too weak!

// ❌ DON'T: Allow unlimited requests
app.post('/api/generate-email', handler); // Add rate limiting!

// ❌ DON'T: Skip input validation
const { prospect } = req.body; // Validate first!

// ❌ DON'T: Use string interpolation for SQL (we use Drizzle ORM, which is safe)
// db.query(`SELECT * FROM users WHERE id = ${userId}`); // SQL injection!
```

### ✅ Always Do This

```typescript
// ✅ DO: Store secrets server-side
const openaiKey = process.env.OPENAI_API_KEY;

// ✅ DO: Get userId from session/auth
const userId = getCurrentUserId(req);

// ✅ DO: Sanitize errors in production
const message = isDev ? error.message : 'An error occurred';

// ✅ DO: Use strong session secrets
secret: process.env.SESSION_SECRET // 32+ random characters

// ✅ DO: Apply rate limiting
app.use('/api/', rateLimiter);

// ✅ DO: Validate all inputs
const parsed = schema.safeParse(req.body);

// ✅ DO: Use parameterized queries (Drizzle ORM does this)
await db.select().from(users).where(eq(users.id, userId));
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to: security@bashostudio.com
3. Include detailed description and reproduction steps
4. Allow reasonable time for patch before public disclosure

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Stripe Security](https://stripe.com/docs/security)
- [GDPR Compliance](https://gdpr.eu/)

## Security Updates

This document should be reviewed and updated:
- When adding new features
- After security audits
- When vulnerabilities are discovered
- At least quarterly

Last updated: 2024-12-25
