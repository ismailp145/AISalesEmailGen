# Deployment URLs

## Backend (Railway)
**URL**: https://aisalesemailgen-production.up.railway.app

**Health Check**: https://aisalesemailgen-production.up.railway.app/api/health

**Status**: ✅ Live and running

**Services Configured**:
- ✅ AI (OpenAI/OpenRouter)
- ✅ Firecrawl
- ✅ Stripe
- ⚠️ SendGrid (optional)
- ⚠️ CRM integrations (optional)

---

## Frontend (Vercel)
**URL**: _To be deployed_

**Environment Variables Needed**:
```
VITE_API_URL=https://aisalesemailgen-production.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
```

---

## Next Steps

### 1. Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Add environment variables:
   - `VITE_API_URL` = `https://aisalesemailgen-production.up.railway.app`
   - `VITE_CLERK_PUBLISHABLE_KEY` = Your Clerk key
5. Deploy!

### 2. Update CORS in Railway

After Vercel deployment:
1. Copy your Vercel URL
2. Go to Railway → Variables
3. Update `CORS_ORIGIN`:
   ```
   https://your-vercel-url.vercel.app,https://your-vercel-url-preview.vercel.app
   ```
4. Redeploy Railway

### 3. Test Everything

- Visit your Vercel URL
- Sign in with Clerk
- Generate an email
- Verify API calls work

---

## Troubleshooting

If you see CORS errors:
- Make sure `CORS_ORIGIN` in Railway includes your Vercel URL
- Redeploy Railway after changing CORS settings
- Clear browser cache

If API calls fail:
- Verify `VITE_API_URL` in Vercel is correct
- Check Railway logs for errors
- Test backend directly: `curl https://aisalesemailgen-production.up.railway.app/api/health`

