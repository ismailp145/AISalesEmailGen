# Railway Backend Environment Variables

Copy these to your Railway project settings (Settings → Variables)

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx

# AI/ML Services
OPENAI_API_KEY=sk-xxxxx
# Optional: Use OpenRouter instead
# OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Email Services
SENDGRID_API_KEY=SG.xxxxx
# Optional: Gmail OAuth
# GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=xxxxx
# Optional: Outlook OAuth
# MICROSOFT_CLIENT_ID=xxxxx
# MICROSOFT_CLIENT_SECRET=xxxxx

# CRM Integrations
# HubSpot
# HUBSPOT_CLIENT_ID=xxxxx
# HUBSPOT_CLIENT_SECRET=xxxxx
# Salesforce
# SALESFORCE_CLIENT_ID=xxxxx
# SALESFORCE_CLIENT_SECRET=xxxxx

# Web Scraping (Firecrawl)
FIRECRAWL_API_KEY=fc-xxxxx

# Payment Processing (Stripe)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# CORS Configuration
# IMPORTANT: Set this to your Vercel frontend URL after deployment
CORS_ORIGIN=https://your-app.vercel.app,https://your-app-preview.vercel.app

# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-session-key-here
```

## How to set these in Railway:

1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Click "New Variable" or "Raw Editor"
5. Paste your environment variables
6. Click "Deploy" to apply changes

