# Railway CORS Fix - Quick Guide

## Problem
Getting `{"message":"Not allowed by CORS"}` error when making API requests from `www.bashostudio.com` to Railway backend.

## Root Cause
The `CORS_ORIGIN` environment variable in Railway doesn't include `https://www.bashostudio.com`.

## Solution

### Step 1: Add Your Domain to Railway CORS_ORIGIN

1. Go to your Railway project: https://railway.app
2. Click on your service
3. Go to **Variables** tab
4. Find `CORS_ORIGIN` variable
5. Update it to include your frontend domain:

```bash
CORS_ORIGIN=https://www.bashostudio.com,https://bashostudio.com
```

**If you also have a Vercel frontend**, include both:
```bash
CORS_ORIGIN=https://www.bashostudio.com,https://bashostudio.com,https://your-app.vercel.app
```

### Step 2: Redeploy Railway

After updating the variable:
1. Railway will automatically redeploy, OR
2. Click **Deploy** button to trigger a new deployment

### Step 3: Verify It Works

Test the endpoint:
```bash
curl -X POST https://aisalesemailgen-production.up.railway.app/api/profile/auto-fill \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.bashostudio.com" \
  -d '{"companyWebsite":"https://example.com","companyName":"Example"}'
```

You should get a successful response instead of CORS error.

## Where to See Logs

**Important**: `console.log` statements in your server code appear in **Railway logs**, NOT in the browser console.

To view Railway logs:
1. Go to Railway dashboard
2. Click on your service
3. Click **Deployments** tab
4. Click on the latest deployment
5. View **Logs** tab

You'll see messages like:
- `[CORS] Blocked request from origin: ...`
- `[API] POST /api/profile/auto-fill - Request received`

## Current CORS Configuration

The CORS middleware is configured in `server/middleware/cors.ts` and:
- ✅ Allows credentials (cookies, auth headers)
- ✅ Allows all HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS)
- ✅ Allows common headers (Content-Type, Authorization, etc.)
- ⚠️ **Requires** `CORS_ORIGIN` to be set in Railway

## Troubleshooting

### Still getting CORS errors?
1. **Check Railway logs** - Look for `[CORS]` messages
2. **Verify domain format** - Must include `https://` and no trailing slash
3. **Clear browser cache** - Old CORS responses might be cached
4. **Check for typos** - Domain must match exactly (case-sensitive for some browsers)

### Multiple domains?
Separate with commas:
```bash
CORS_ORIGIN=https://www.bashostudio.com,https://bashostudio.com,https://app.bashostudio.com
```

### Development vs Production?
- **Development**: CORS allows `localhost:3000` and `localhost:5173` by default
- **Production**: Must set `CORS_ORIGIN` environment variable

