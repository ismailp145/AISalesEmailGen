# Vercel Frontend Environment Variables

Add these in your Vercel project settings (Settings → Environment Variables)

```bash
# Backend API URL (Railway)
# IMPORTANT: Update this with your Railway URL after backend deployment
VITE_API_URL=https://your-app.railway.app

# Authentication (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

## How to set these in Vercel:

1. Go to your Vercel project
2. Click "Settings" → "Environment Variables"
3. Add each variable:
   - Name: `VITE_API_URL`
   - Value: Your Railway URL (e.g., `https://your-app.railway.app`)
   - Environment: Production, Preview, Development
4. Add Clerk key:
   - Name: `VITE_CLERK_PUBLISHABLE_KEY`
   - Value: Your Clerk publishable key
   - Environment: Production, Preview, Development
5. Redeploy your application for changes to take effect

