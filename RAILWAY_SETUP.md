# Railway Backend Setup

Railway will automatically detect your Node.js project and configure it correctly.

## Configuration

Railway auto-detects these settings from your `package.json`:

- **Build Command**: `npm run build` (uses the `build` script)
- **Start Command**: `npm start` (uses the `start` script)
- **Node Version**: Detected from `package.json` engines field or uses latest LTS

## Manual Configuration (if needed)

If Railway doesn't auto-detect correctly, you can manually set:

### In Railway Dashboard → Settings → Deploy:

**Build Command**:
```bash
npm run build:backend
```

**Start Command**:
```bash
npm start
```

**Root Directory**: Leave empty (uses project root)

### Environment Variables

Add all variables from `ENV_RAILWAY.md` in Settings → Variables

## Troubleshooting

### Build fails with Node version error
Add this to your `package.json`:
```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### Build command not found
Manually set build command in Railway dashboard:
- Go to Settings → Deploy
- Set Build Command: `npm run build:backend`
- Set Start Command: `npm start`

### Port issues
Railway automatically sets the `PORT` environment variable. Your app should use:
```javascript
const PORT = process.env.PORT || 3000;
```

This is already configured in your `server/index.ts`.

## Deploy

1. Push your code to GitHub
2. Railway will automatically deploy
3. Check logs for any errors
4. Copy your Railway URL

That's it! Railway handles everything else automatically.

