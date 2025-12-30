import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Resolve the public directory path
  // In serverless, __dirname points to the bundled file location
  // The public folder is at the same level as the bundled server file
  const distPath = path.resolve(__dirname, "public");
  
  // Fallback: if not found, try relative to process.cwd() (for Vercel)
  let publicPath = distPath;
  if (!fs.existsSync(publicPath)) {
    // Try alternative path resolution for serverless environments
    const altPath = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(altPath)) {
      publicPath = altPath;
    } else {
      // Last resort: try relative to current working directory
      const cwdPath = path.resolve(process.cwd(), "public");
      if (fs.existsSync(cwdPath)) {
        publicPath = cwdPath;
      } else {
        console.warn(
          `[Static] Could not find the build directory. Tried: ${distPath}, ${altPath}, ${cwdPath}`
        );
        console.warn(`[Static] __dirname: ${__dirname}, cwd: ${process.cwd()}`);
        // Don't throw - let the catch-all route handle it
      }
    }
  }
  
  console.log(`[Static] Serving static files from: ${publicPath}`);
  console.log(`[Static] index.html exists: ${fs.existsSync(path.resolve(publicPath, "index.html"))}`);

  // Create static middleware once (more efficient)
  const staticMiddleware = express.static(publicPath, {
    setHeaders: (res, filePath) => {
      // Ensure HTML files are served with correct content-type
      if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }
      // Ensure JavaScript files have correct content-type
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
      // Ensure CSS files have correct content-type
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    }
  });

  // Serve static files with proper content-type headers
  // IMPORTANT: Exclude API routes from static file serving to prevent 405 errors
  app.use((req, res, next) => {
    // Skip static middleware for API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    // Use static middleware for all other routes
    staticMiddleware(req, res, next);
  });

  // Fall through to index.html for client-side routing
  // This must be after all API routes are registered
  app.use("*", (_req, res, next) => {
    // Skip if this is an API route (should have been handled already)
    // If an API route reaches here, it means it wasn't found - return 404
    if (_req.path.startsWith('/api/')) {
      if (!res.headersSent) {
        return res.status(404).json({
          error: "Not found",
          message: `API endpoint ${_req.method} ${_req.path} not found`
        });
      }
      return next();
    }
    
    const indexPath = path.resolve(publicPath, "index.html");
    
    // Check if index.html exists
    if (fs.existsSync(indexPath)) {
      // Explicitly set content-type header
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      
      // Use sendFile with absolute path
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Error sending index.html:', err);
          if (!res.headersSent) {
            res.status(500).json({
              error: "Internal server error",
              message: "Failed to serve frontend"
            });
          }
        }
      });
    } else {
      console.error(`index.html not found at: ${indexPath}`);
      if (!res.headersSent) {
        res.status(404).json({
          error: "Not found",
          message: "Frontend build not found. Please ensure the client is built before deployment.",
          debug: process.env.NODE_ENV === 'development' ? {
            publicPath,
            indexPath,
            cwd: process.cwd(),
            __dirname
          } : undefined
        });
      }
    }
  });
}
