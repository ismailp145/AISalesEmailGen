# Critical Fixes Checklist

**Print this out and check off as you complete each item.**

---

## 🚀 Setup (30 minutes)

### Dependencies
- [ ] Run: `npm install express-rate-limit cors @types/cors connect-redis redis helmet dompurify @types/dompurify`
- [ ] Verify installation: `npm list express-rate-limit cors redis helmet`

### Environment
- [ ] Create `.env.example` file (copy from QUICK_FIX_GUIDE.md)
- [ ] Generate SESSION_SECRET: `openssl rand -base64 32`
- [ ] Add SESSION_SECRET to `.env`
- [ ] Sign up for Redis (Upstash free tier recommended)
- [ ] Add REDIS_URL to `.env`
- [ ] Set CORS_ORIGIN in `.env`
- [ ] Set ALLOWED_HOSTS in `.env`

---

## 🔧 Code Fixes (4-6 hours)

### Fix 1: Environment Validation (5 min)
- [ ] File: `server/index.ts` lines 11-17
- [ ] Uncomment: `import { logEnvironmentValidation }`
- [ ] Uncomment: `import { configureCors, validateCorsConfig }`
- [ ] Uncomment: `import { apiLimiter, strictLimiter }`
- [ ] Uncomment: `logEnvironmentValidation();`
- [ ] Test: `npm run dev` - should see validation output

### Fix 2: CORS Configuration (5 min)
- [ ] File: `server/index.ts` lines 29-31
- [ ] Uncomment: `validateCorsConfig();`
- [ ] Uncomment: `app.use(configureCors());`
- [ ] File: `server/middleware/cors.ts`
- [ ] Replace entire file with code from QUICK_FIX_GUIDE.md
- [ ] Test: Try accessing API from different origin

### Fix 3: Request Size Limits (2 min)
- [ ] File: `server/index.ts` lines 33-45
- [ ] Add `limit: '100kb'` to express.json()
- [ ] Add `limit: '100kb'` to express.urlencoded()
- [ ] Test: Try sending large payload (should be rejected)

### Fix 4: Rate Limiting (5 min)
- [ ] File: `server/index.ts` lines 91-97
- [ ] Uncomment all rate limiter lines
- [ ] File: `server/middleware/rate-limit.ts`
- [ ] Replace entire file with code from QUICK_FIX_GUIDE.md
- [ ] Test: Make 101 requests quickly (should be rate limited)

### Fix 5: Redis Session Storage (15 min)
- [ ] File: `server/index.ts`
- [ ] Add imports: `RedisStore`, `createClient`
- [ ] Replace session configuration (lines 76-89)
- [ ] Use code from QUICK_FIX_GUIDE.md
- [ ] Test: Restart server, verify session persists

### Fix 6: Sanitize Errors (20 min)
- [ ] File: `server/routes.ts`
- [ ] Add `sanitizeError()` function at top
- [ ] Update ALL catch blocks (~30 locations)
- [ ] Search for: `message: error?.message`
- [ ] Replace with: `...sanitizeError(error)`
- [ ] Test: Trigger error, verify no stack trace shown

### Fix 7: Prospect Data Scoping (10 min)
- [ ] File: `server/routes.ts` line ~1617
- [ ] Update `/api/prospects` endpoint
- [ ] File: `server/storage.ts`
- [ ] Update `getAllProspects()` - add userId parameter
- [ ] Update `getProspectsByCrmSource()` - add userId parameter
- [ ] Update interface definition
- [ ] Test: Create 2 users, verify data isolation

### Fix 8: OAuth Redirect Validation (10 min)
- [ ] File: `server/routes.ts` line ~83
- [ ] Update `getBaseUrl()` function
- [ ] Add host validation in production
- [ ] Test: Try OAuth with invalid host (should fail)

### Fix 9: Require Clerk in Production (5 min)
- [ ] File: `server/env-validation.ts`
- [ ] Add `CLERK_SECRET_KEY` to PRODUCTION_VARS
- [ ] Add `VITE_CLERK_PUBLISHABLE_KEY` to PRODUCTION_VARS
- [ ] Add validation check
- [ ] Test: Set NODE_ENV=production without Clerk (should error)

### Fix 10: Security Headers (5 min)
- [ ] File: `server/index.ts`
- [ ] Add import: `import helmet from 'helmet'`
- [ ] Add helmet middleware after CORS
- [ ] Use code from QUICK_FIX_GUIDE.md
- [ ] Test: Check response headers (should have security headers)

### Fix 11: Graceful Shutdown (5 min)
- [ ] File: `server/index.ts`
- [ ] Add SIGTERM handler at end of file
- [ ] Add SIGINT handler at end of file
- [ ] Test: Kill process, verify clean shutdown

### Fix 12: Webhook Replay Protection (15 min)
- [ ] File: `shared/schema.ts`
- [ ] Add `processedWebhooks` table definition
- [ ] File: `server/storage.ts`
- [ ] Add `isWebhookProcessed()` method
- [ ] Add `markWebhookProcessed()` method
- [ ] Update interface
- [ ] File: `server/routes.ts`
- [ ] Update Stripe webhook handler
- [ ] Add replay check
- [ ] Run: `npm run db:push`
- [ ] Test: Send same webhook twice (should ignore second)

---

## ✅ Verification (30 minutes)

### Code Quality
- [ ] Run: `npm run check` (TypeScript should compile)
- [ ] Run: `npm audit` (check for vulnerabilities)
- [ ] Fix any critical vulnerabilities
- [ ] Review git diff for changes

### Local Testing
- [ ] Start dev server: `npm run dev`
- [ ] Verify environment validation runs
- [ ] Check Redis connection in logs
- [ ] Test rate limiting (make 101 requests)
- [ ] Test CORS (different origin)
- [ ] Test error messages (no stack traces)
- [ ] Test session persistence (restart server)

### Feature Testing
- [ ] Sign up new user
- [ ] Generate single email
- [ ] Generate bulk emails
- [ ] Test subscription upgrade
- [ ] Test free trial
- [ ] Send test email
- [ ] Check email history

---

## 🚀 Deployment Prep (1 hour)

### Infrastructure
- [ ] Choose hosting provider (Render/Railway/Fly.io)
- [ ] Create account and project
- [ ] Configure environment variables
- [ ] Set up Redis (Upstash or Redis Cloud)
- [ ] Verify database connection (Neon)

### Monitoring
- [ ] Sign up for Sentry (error tracking)
- [ ] Add SENTRY_DSN to environment
- [ ] Sign up for UptimeRobot (uptime monitoring)
- [ ] Configure alerts

### Domain & SSL
- [ ] Configure custom domain
- [ ] Set up SSL certificate
- [ ] Update CORS_ORIGIN
- [ ] Update ALLOWED_HOSTS
- [ ] Update Stripe webhook URL
- [ ] Update OAuth callback URLs

---

## 🧪 Staging Testing (2 hours)

### Deploy to Staging
- [ ] Deploy to staging environment
- [ ] Verify all services connected
- [ ] Check logs for errors
- [ ] Verify Redis connection
- [ ] Verify database connection

### Critical Flow Testing
- [ ] User signup and login
- [ ] Email generation (single)
- [ ] Email generation (bulk)
- [ ] Subscription upgrade
- [ ] Stripe webhook processing
- [ ] Free trial activation
- [ ] Email sending
- [ ] CRM integrations

### Security Testing
- [ ] Test rate limiting (100+ requests)
- [ ] Test CORS (different origin)
- [ ] Verify error messages sanitized
- [ ] Test with invalid tokens
- [ ] Verify data isolation (2 users)
- [ ] Test OAuth with invalid host
- [ ] Test webhook replay attack

### Performance Testing
- [ ] Load test (50 concurrent users)
- [ ] Monitor response times
- [ ] Check database connections
- [ ] Verify no memory leaks
- [ ] Check Redis memory usage

---

## 📊 Pre-Production (1 hour)

### Documentation
- [ ] Update README with production setup
- [ ] Document environment variables
- [ ] Create runbook for common issues
- [ ] Document backup procedures
- [ ] Create incident response plan

### Final Checks
- [ ] All critical issues fixed
- [ ] All tests passing
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Domain and SSL working
- [ ] Stripe webhooks working
- [ ] Error tracking working

---

## 🎉 Production Deployment

### Deploy
- [ ] Deploy to production
- [ ] Verify all services connected
- [ ] Check logs for errors
- [ ] Test critical flows
- [ ] Verify monitoring working

### Monitor (First 24 Hours)
- [ ] Check error logs every hour
- [ ] Monitor OpenAI costs
- [ ] Check Stripe webhooks
- [ ] Monitor user signups
- [ ] Watch for performance issues
- [ ] Respond to any alerts

### Week 1
- [ ] Check logs daily
- [ ] Monitor costs daily
- [ ] Gather user feedback
- [ ] Fix any issues immediately
- [ ] Optimize based on usage

---

## 📝 Notes & Issues

Use this space to track issues you encounter:

```
Issue 1:
- What: 
- When:
- Fix:

Issue 2:
- What:
- When:
- Fix:

Issue 3:
- What:
- When:
- Fix:
```

---

## 🆘 Emergency Contacts

- **Hosting Support**: [Provider support URL]
- **Redis Support**: [Redis provider support]
- **Stripe Support**: https://support.stripe.com
- **Clerk Support**: https://clerk.com/support

---

## ⏱️ Time Tracking

- Setup: _____ hours (target: 0.5)
- Code Fixes: _____ hours (target: 4-6)
- Verification: _____ hours (target: 0.5)
- Deployment Prep: _____ hours (target: 1)
- Staging Testing: _____ hours (target: 2)
- Pre-Production: _____ hours (target: 1)
- **Total: _____ hours (target: 8-12)**

---

**Started:** _______________  
**Completed:** _______________  
**Deployed:** _______________

---

*Keep this checklist handy and check off items as you complete them.*  
*Don't skip any critical items—they're all important for security and stability.*

**Good luck! 🚀**

