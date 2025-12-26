# Quick Start: Split Deployment

## TL;DR - Deploy in 15 Minutes

### 1. Deploy Backend to Railway (5 min)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select your repo
3. Add environment variables from `ENV_RAILWAY.md`
4. Deploy → Copy Railway URL

### 2. Deploy Frontend to Vercel (5 min)

1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import your repo
3. Add environment variables:
   - `VITE_API_URL` = Your Railway URL
   - `VITE_CLERK_PUBLISHABLE_KEY` = Your Clerk key
4. Deploy → Copy Vercel URL

### 3. Connect Them (5 min)

1. Update `CORS_ORIGIN` in Railway with your Vercel URL
2. Redeploy Railway
3. Test your app!

## Files Changed

- ✅ `client/src/lib/queryClient.ts` - Now uses `VITE_API_URL`
- ✅ `vercel.json` - Frontend-only deployment
- ✅ `railway.json` - Railway configuration
- ✅ `nixpacks.toml` - Build configuration
- ✅ `.railwayignore` - Ignore frontend files

## What's Different?

**Before**: Monolithic deployment on Vercel (serverless functions)
- ❌ 10-second timeout
- ❌ Cold starts
- ❌ Bundling issues
- ❌ No background jobs

**After**: Split deployment (Railway + Vercel)
- ✅ No timeouts
- ✅ No cold starts
- ✅ No bundling issues
- ✅ Background jobs work
- ✅ Better performance
- ✅ Easier debugging

## Environment Variables

### Railway Backend
See `ENV_RAILWAY.md` for complete list. Key ones:
- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `CORS_ORIGIN` (set to Vercel URL)

### Vercel Frontend
See `ENV_VERCEL.md` for complete list:
- `VITE_API_URL` (Railway URL)
- `VITE_CLERK_PUBLISHABLE_KEY`

## Testing Locally

### Backend
```bash
npm run dev
# Server runs on http://localhost:5000
```

### Frontend (in separate terminal)
```bash
# Set env var temporarily
export VITE_API_URL=http://localhost:5000
npm run build:frontend
cd dist/public && npx serve
```

## Troubleshooting

**CORS errors?**
→ Check `CORS_ORIGIN` in Railway includes your Vercel URL

**404 on API calls?**
→ Check `VITE_API_URL` in Vercel is correct

**Can't sign in?**
→ Verify Clerk keys match in both Railway and Vercel

## Full Documentation

See `SPLIT_DEPLOYMENT_GUIDE.md` for complete step-by-step instructions.

