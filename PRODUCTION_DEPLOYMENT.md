# Production Deployment Guide

This guide covers the complete process for deploying Basho Studio (AI Sales Email Generator) to production.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Neon recommended)
- Domain name configured
- SSL certificate (handled by most hosting providers)
- Stripe account (for payments)
- OpenAI API key (or alternative AI provider)

## 1. Pre-Deployment Checklist

### Security Review
- [ ] All secrets stored in environment variables (never in code)
- [ ] `.env` file listed in `.gitignore`
- [ ] Database credentials secured
- [ ] API keys rotated from development to production
- [ ] Stripe webhook secret configured for production endpoint
- [ ] CORS configured with allowed origins only
- [ ] Rate limiting enabled
- [ ] Session secret is strong and unique (32+ characters)

### Dependency Audit
- [ ] Run `npm audit` to check for vulnerabilities
- [ ] Update vulnerable packages: `npm audit fix`
- [ ] Review and update major dependencies if needed
- [ ] Test application after dependency updates

### Code Quality
- [ ] TypeScript type checking passes: `npm run check`
- [ ] All builds complete successfully: `npm run build`
- [ ] Critical user flows tested (email generation, subscription, trial)

## 2. Environment Configuration

### Required Environment Variables

Create a `.env` file on your production server with these required variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host/database

# AI Provider (pick one)
OPENAI_API_KEY=sk-...
# OR
OPENROUTER_API_KEY=sk-or-v1-...

# Authentication (recommended)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Stripe Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
NODE_ENV=production
PORT=3000
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
```

### Optional but Recommended

```bash
# Email delivery
SENDGRID_API_KEY=SG...

# CRM integrations
HUBSPOT_API_KEY=pat-na1-...

# Web scraping
FIRECRAWL_API_KEY=fc-...

# Session storage (highly recommended for production)
REDIS_URL=redis://default:password@host:port

# Security
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 3. Database Setup

### Initialize Database

1. **Create PostgreSQL database** (Neon recommended):
   - Sign up at https://neon.tech
   - Create a new project
   - Copy the connection string to `DATABASE_URL`

2. **Push database schema**:
   ```bash
   npm run db:push
   ```

3. **Verify tables created**:
   - Connect to your database
   - Verify tables exist: `user_profiles`, `prospects`, `email_activities`, `sequences`, etc.

### Database Connection Pooling

For production, configure connection pooling in your database URL:
```
postgresql://user:password@host/database?pool_timeout=0&connection_limit=10
```

## 4. Stripe Configuration

### Set Up Production Stripe

1. **Switch to Live Mode** in Stripe Dashboard

2. **Get API Keys**:
   - Go to Developers > API Keys
   - Copy Live Secret Key: `sk_live_...`
   - Set `STRIPE_SECRET_KEY` environment variable

3. **Create Pro Product**:
   - Go to Products > Add product
   - Name: "Pro Plan"
   - Price: $19.99/month (or $20/month)
   - Recurring: Monthly
   - Copy Price ID: `price_...`
   - Set `STRIPE_PRO_PRICE_ID` environment variable

4. **Configure Webhook**:
   - Go to Developers > Webhooks > Add endpoint
   - Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy Signing Secret: `whsec_...`
   - Set `STRIPE_WEBHOOK_SECRET` environment variable

5. **Test Webhook**:
   - Send test event from Stripe Dashboard
   - Verify webhook receives and processes event
   - Check server logs for any errors

## 5. Build Application

### Build for Production

```bash
# Install dependencies
npm install --production=false

# Type check
npm run check

# Build application
npm run build
```

This creates a production-optimized build in the `dist/` directory.

### Verify Build

```bash
# Check that dist directory exists
ls -la dist/

# Verify main files present
ls dist/index.cjs
ls dist/public/
```

## 6. Deployment Options

### Option A: VPS/VM (DigitalOcean, AWS EC2, Linode)

1. **Set up server**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   ```

2. **Deploy application**:
   ```bash
   # Clone repository
   git clone <your-repo-url>
   cd AISalesEmailGen
   
   # Install dependencies and build
   npm install --production=false
   npm run build
   
   # Set up environment variables
   nano .env
   # (paste your production environment variables)
   
   # Start with PM2
   pm2 start npm --name "basho-studio" -- start
   pm2 save
   pm2 startup
   ```

3. **Configure Nginx reverse proxy**:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **Set up SSL with Let's Encrypt**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Option B: Platform-as-a-Service (Heroku, Render, Railway)

#### Render.com Example:

1. **Connect Repository**:
   - Go to https://render.com
   - New > Web Service
   - Connect GitHub repository

2. **Configure Service**:
   - Name: basho-studio
   - Environment: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Instance Type: Standard or higher

3. **Add Environment Variables**:
   - Go to Environment tab
   - Add all required variables from `.env.example`

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for build and deployment

### Option C: Docker (Advanced)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
```

Deploy with Docker Compose:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    restart: unless-stopped
```

## 7. Post-Deployment Verification

### Health Checks

1. **Test API health endpoint**:
   ```bash
   curl https://yourdomain.com/api/health
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "ai": "configured",
     "firecrawl": "configured",
     "sendgrid": "configured",
     "stripe": "configured"
   }
   ```

2. **Test critical flows**:
   - [ ] User sign up/sign in
   - [ ] Email generation (single)
   - [ ] Trial status display
   - [ ] Subscription upgrade (Stripe checkout)
   - [ ] Email limit enforcement
   - [ ] Settings page loads

### Monitoring

1. **Set up logging**:
   - Configure log aggregation (Datadog, Loggly, CloudWatch)
   - Monitor error rates
   - Track API response times

2. **Monitor database**:
   - Check connection pool usage
   - Monitor query performance
   - Set up alerts for connection issues

3. **Monitor Stripe**:
   - Check webhook delivery success rate
   - Monitor failed payment alerts
   - Review subscription metrics

## 8. Production Hardening

### Session Storage

⚠️ **Important**: The default in-memory session store is NOT suitable for production.

**Option 1: Redis (Recommended)**
```bash
# Install Redis adapter
npm install connect-redis redis

# Update server/index.ts to use Redis session store
# Set REDIS_URL environment variable
```

**Option 2: PostgreSQL**
```bash
# Already included as dependency
# Update server/index.ts to use connect-pg-simple
```

### Rate Limiting

Add rate limiting middleware to prevent abuse:
```bash
npm install express-rate-limit
```

### Request Size Limits

Configure in `server/index.ts`:
```typescript
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
```

### CORS Configuration

Set `CORS_ORIGIN` environment variable:
```bash
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

### Error Handling

- Never expose stack traces in production
- Log errors server-side only
- Return generic error messages to clients

## 9. Scaling Considerations

### Horizontal Scaling

- Use Redis for session storage (enables multiple server instances)
- Use a load balancer (AWS ALB, Nginx, CloudFlare)
- Configure sticky sessions if needed

### Database Scaling

- Enable connection pooling
- Add read replicas for heavy read workloads
- Consider caching frequently accessed data

### Background Jobs

- Move long-running tasks to queues (Bull, BullMQ)
- Use separate worker processes for email sending
- Schedule cleanup jobs for old data

## 10. Backup and Recovery

### Database Backups

1. **Automated backups** (Neon provides this automatically)
2. **Manual backup**:
   ```bash
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   ```
3. **Test restore procedure** regularly

### Application Backups

- Store `.env` file securely (password manager or secrets vault)
- Document all configuration changes
- Keep deployment scripts in version control

## 11. Troubleshooting

### Common Issues

**Issue**: "CORS error in browser"
- Solution: Set `CORS_ORIGIN` environment variable with your domain

**Issue**: "Database connection failed"
- Solution: Check `DATABASE_URL` is correct and database is accessible

**Issue**: "Stripe webhook not working"
- Solution: Verify webhook URL is publicly accessible and secret matches

**Issue**: "Sessions not persisting across server restarts"
- Solution: Switch from memory store to Redis or PostgreSQL session store

**Issue**: "High memory usage"
- Solution: Check for memory leaks, enable connection pooling, add rate limiting

## 12. Maintenance

### Regular Tasks

- **Weekly**: Review error logs and fix issues
- **Monthly**: Check for dependency updates (`npm outdated`)
- **Quarterly**: Security audit (`npm audit`)
- **As needed**: Scale resources based on usage

### Update Process

1. Test updates in staging environment
2. Create database backup
3. Deploy during low-traffic period
4. Monitor logs and metrics
5. Have rollback plan ready

## Support

For issues or questions:
- Check application logs first
- Review environment configuration
- Test in development environment
- Check database connectivity
- Verify external service status (Stripe, OpenAI, etc.)

## Security Checklist

Before going live:
- [ ] All API keys are production keys (not test/dev keys)
- [ ] Secrets are stored securely (never in code)
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Database access restricted to application only
- [ ] Environment variables validated on startup
- [ ] Error messages don't expose sensitive information
- [ ] Session secret is strong and unique
- [ ] Regular security audits scheduled

## Production Launch Checklist

- [ ] All environment variables configured
- [ ] Database initialized and backed up
- [ ] Stripe configured with live keys and webhook
- [ ] SSL certificate active
- [ ] Domain DNS configured
- [ ] Health check endpoint responding
- [ ] Test user flow end-to-end
- [ ] Monitoring and alerts set up
- [ ] Backup procedures documented and tested
- [ ] Support contacts documented
- [ ] Rollback plan prepared

🎉 You're ready for production!
