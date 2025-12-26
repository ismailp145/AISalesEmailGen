# Split Deployment Guide: Railway + Vercel

This guide walks you through deploying your AI Sales Email Generator with a split architecture:
- **Backend**: Railway (Express API server)
- **Frontend**: Vercel (React static site)

## Why Split Deployment?

✅ **No bundling issues** - Railway runs your code directly  
✅ **No serverless limitations** - No timeouts, cold starts, or execution limits  
✅ **Better performance** - Persistent server, faster response times  
✅ **Background jobs** - Email scheduling works properly  
✅ **WebSockets ready** - For future real-time features  
✅ **Easier debugging** - Persistent logs, better error tracking  
✅ **Independent scaling** - Scale frontend and backend separately  

---

## Prerequisites

- GitHub account with your repository
- Railway account (sign up at [railway.app](https://railway.app))
- Vercel account (sign up at [vercel.com](https://vercel.com))
- All your environment variables ready (API keys, database URL, etc.)

---

## Part 1: Deploy Backend to Railway

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select your `AISalesEmailGen` repository
6. Railway will automatically detect it's a Node.js project

### Step 2: Configure Environment Variables

1. In your Railway project, click on your service
2. Go to "Variables" tab
3. Click "Raw Editor"
4. Copy all variables from `ENV_RAILWAY.md` and paste them
5. **Important**: Update these values with your actual credentials:
   - `DATABASE_URL` - Your Neon PostgreSQL connection string
   - `CLERK_SECRET_KEY` - Your Clerk secret key
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `SENDGRID_API_KEY` - Your SendGrid API key
   - `FIRECRAWL_API_KEY` - Your Firecrawl API key
   - `STRIPE_SECRET_KEY` - Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret
   - All other API keys for services you're using

6. **Leave `CORS_ORIGIN` as placeholder for now** - we'll update it after deploying frontend

### Step 3: Configure Build Settings

Railway should auto-detect these, but verify:
- **Build Command**: `npm run build:backend`
- **Start Command**: `npm start`
- **Root Directory**: `/` (project root)

### Step 4: Deploy Backend

1. Click "Deploy" or push to your GitHub repo
2. Railway will automatically build and deploy
3. Wait for deployment to complete (usually 2-5 minutes)
4. Once deployed, copy your Railway URL (e.g., `https://aisalesemailgen-production.up.railway.app`)

### Step 5: Test Backend

Test your backend is working:
```bash
curl https://your-app.railway.app/api/health
```

You should get a response indicating the server is running.

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your `AISalesEmailGen` repository from GitHub
4. Vercel will auto-detect the configuration from `vercel.json`

### Step 2: Configure Environment Variables

1. In Vercel project settings, go to "Environment Variables"
2. Add the following variables (from `ENV_VERCEL.md`):

**Variable 1:**
- Name: `VITE_API_URL`
- Value: Your Railway URL (e.g., `https://your-app.railway.app`)
- Environments: ✅ Production, ✅ Preview, ✅ Development

**Variable 2:**
- Name: `VITE_CLERK_PUBLISHABLE_KEY`
- Value: Your Clerk publishable key (starts with `pk_live_` or `pk_test_`)
- Environments: ✅ Production, ✅ Preview, ✅ Development

### Step 3: Configure Build Settings

Vercel should use these from `vercel.json`:
- **Build Command**: `npm run build:frontend`
- **Output Directory**: `dist/public`
- **Install Command**: `npm install`

### Step 4: Deploy Frontend

1. Click "Deploy"
2. Wait for build to complete (usually 1-3 minutes)
3. Once deployed, copy your Vercel URL (e.g., `https://your-app.vercel.app`)

---

## Part 3: Connect Frontend and Backend

### Step 1: Update CORS on Railway

1. Go back to your Railway project
2. Go to "Variables" tab
3. Find `CORS_ORIGIN` variable
4. Update it with your Vercel URLs:
   ```
   https://your-app.vercel.app,https://your-app-git-main-yourname.vercel.app
   ```
5. Click "Deploy" to apply changes

### Step 2: Test the Connection

1. Visit your Vercel URL
2. Try to sign in
3. Try to generate an email
4. Check that all API calls work

If you see CORS errors, double-check:
- Railway has the correct `CORS_ORIGIN` set
- Vercel has the correct `VITE_API_URL` set
- Both deployments are live and running

---

## Part 4: Configure OAuth Callbacks

If you're using OAuth integrations (Gmail, Outlook, Salesforce, HubSpot), you need to update the callback URLs:

### For Gmail OAuth:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to your project → APIs & Services → Credentials
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URI:
   ```
   https://your-app.railway.app/api/email/gmail/callback
   ```

### For Outlook OAuth:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to App Registrations → Your App → Authentication
3. Add redirect URI:
   ```
   https://your-app.railway.app/api/email/outlook/callback
   ```

### For Salesforce OAuth:
1. Go to Salesforce Setup → App Manager
2. Edit your Connected App
3. Update Callback URL:
   ```
   https://your-app.railway.app/api/crm/salesforce/callback
   ```

### For HubSpot OAuth:
1. Go to HubSpot Developer Account
2. Edit your app settings
3. Update Redirect URL:
   ```
   https://your-app.railway.app/api/crm/hubspot/callback
   ```

---

## Part 5: Configure Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers → Webhooks
3. Click "Add endpoint"
4. Endpoint URL:
   ```
   https://your-app.railway.app/api/stripe/webhook
   ```
5. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
6. Copy the webhook signing secret
7. Update `STRIPE_WEBHOOK_SECRET` in Railway environment variables

---

## Part 6: Verify Everything Works

### Backend Health Check
```bash
curl https://your-app.railway.app/api/health
```

### Frontend Loading
Visit `https://your-app.vercel.app` and verify:
- ✅ Page loads
- ✅ Can sign in with Clerk
- ✅ Can generate emails
- ✅ Can detect triggers
- ✅ Can connect integrations
- ✅ Static assets load (images, CSS, JS)

### Check Railway Logs
1. Go to Railway project
2. Click on your service
3. Go to "Deployments" tab
4. Click on latest deployment
5. View logs for any errors

### Check Vercel Logs
1. Go to Vercel project
2. Click on "Deployments"
3. Click on latest deployment
4. View function logs if any issues

---

## Troubleshooting

### CORS Errors

**Symptom**: Browser console shows CORS errors when making API calls

**Solution**:
1. Verify `CORS_ORIGIN` in Railway includes your Vercel URL
2. Make sure there are no trailing slashes
3. Redeploy Railway after changing CORS settings
4. Clear browser cache and try again

### 404 on API Calls

**Symptom**: API calls return 404 Not Found

**Solution**:
1. Verify `VITE_API_URL` in Vercel is set correctly
2. Make sure Railway backend is deployed and running
3. Test backend directly: `curl https://your-railway-url.app/api/health`
4. Redeploy Vercel after changing environment variables

### Authentication Not Working

**Symptom**: Can't sign in, or authentication errors

**Solution**:
1. Verify `CLERK_SECRET_KEY` is set in Railway
2. Verify `VITE_CLERK_PUBLISHABLE_KEY` is set in Vercel
3. Make sure both keys are from the same Clerk application
4. Check Clerk dashboard for any issues

### Database Connection Errors

**Symptom**: Errors about database connection in Railway logs

**Solution**:
1. Verify `DATABASE_URL` is correct in Railway
2. Make sure Neon database is accessible
3. Check if database has SSL mode enabled: `?sslmode=require`
4. Test connection from Railway logs

### Build Failures

**Railway Build Fails**:
- Check Railway logs for specific error
- Verify all dependencies are in `package.json`
- Make sure `npm run build:backend` works locally

**Vercel Build Fails**:
- Check Vercel build logs
- Verify `npm run build:frontend` works locally
- Make sure all environment variables are set

---

## Monitoring and Maintenance

### Railway Monitoring
- View logs: Railway Dashboard → Service → Deployments → Logs
- View metrics: Railway Dashboard → Service → Metrics
- Set up alerts: Railway Dashboard → Service → Settings → Notifications

### Vercel Monitoring
- View analytics: Vercel Dashboard → Analytics
- View logs: Vercel Dashboard → Deployments → Function Logs
- Monitor performance: Vercel Dashboard → Speed Insights

### Database Monitoring
- Neon Dashboard: Monitor connection count, query performance
- Set up alerts for high connection usage
- Regular backups (Neon does this automatically)

---

## Updating Your Application

### Backend Updates (Railway)
1. Push changes to GitHub
2. Railway automatically redeploys
3. Monitor deployment in Railway dashboard
4. Check logs for any errors

### Frontend Updates (Vercel)
1. Push changes to GitHub
2. Vercel automatically redeploys
3. Monitor deployment in Vercel dashboard
4. Preview deployments for each PR

### Database Migrations
```bash
# Run migrations on Railway
npm run db:push
```

Or use Railway's CLI:
```bash
railway run npm run db:push
```

---

## Cost Estimates

### Railway (Backend)
- **Hobby Plan**: $5/month credit (enough for small apps)
- **Pro Plan**: $20/month + usage
- Estimated cost for this app: ~$5-15/month

### Vercel (Frontend)
- **Hobby Plan**: Free (personal projects)
- **Pro Plan**: $20/month (commercial use)
- Estimated cost: Free to $20/month

### Total Estimated Cost
- **Development/Personal**: $5-10/month
- **Production/Commercial**: $25-35/month

---

## Next Steps

1. ✅ Backend deployed to Railway
2. ✅ Frontend deployed to Vercel
3. ✅ CORS configured
4. ✅ OAuth callbacks updated
5. ✅ Stripe webhooks configured
6. ✅ Everything tested and working

### Optional Enhancements:
- Set up custom domain for Railway backend
- Set up custom domain for Vercel frontend
- Configure email alerts for errors
- Set up monitoring with Sentry or LogRocket
- Add CI/CD tests before deployment
- Set up staging environments

---

## Support and Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Clerk Docs**: https://clerk.com/docs
- **Stripe Docs**: https://stripe.com/docs

## Need Help?

If you run into issues:
1. Check the troubleshooting section above
2. Review Railway and Vercel logs
3. Test each component individually
4. Verify all environment variables are set correctly

---

**Congratulations!** 🎉 Your application is now deployed with a professional split architecture!

