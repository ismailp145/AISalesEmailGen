/**
 * CORS Configuration Middleware
 * 
 * Configures Cross-Origin Resource Sharing for production security.
 * 
 * TO ENABLE:
 * 1. Install cors: npm install cors @types/cors
 * 2. Import and use in server/index.ts
 * 3. Set CORS_ORIGIN environment variable with allowed domains
 * 
 * USAGE:
 * import { configureCors } from './middleware/cors';
 * app.use(configureCors());
 */

// TODO: Uncomment after installing cors
import cors from 'cors';
import type { CorsOptions } from 'cors';

/**
 * Configure CORS with environment-based allowed origins
 */
export function configureCors() {
  // TODO: Uncomment after installing cors
  
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5173']; // Development defaults

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies and authorization headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Dev-User-Id'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 600, // Cache preflight requests for 10 minutes
  };

  return cors(corsOptions);
  

  // Placeholder middleware that allows all origins (development mode)
  // return (req: any, res: any, next: any) => {
  //   // Development mode: Allow all origins
  //   res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  //   res.header('Access-Control-Allow-Credentials', 'true');
  //   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  //   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-Dev-User-Id');
    
  //   if (req.method === 'OPTIONS') {
  //     return res.sendStatus(200);
  //   }
    
  //   next();
  // };
}

/**
 * Validate CORS configuration on startup
 */
export function validateCorsConfig(): void {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const corsOrigin = process.env.CORS_ORIGIN;

  if (!isDevelopment && !corsOrigin) {
    console.warn('⚠️  WARNING: CORS_ORIGIN not set in production. This is a security risk!');
    console.warn('⚠️  Set CORS_ORIGIN environment variable with allowed domains.');
  }

  if (corsOrigin) {
    const origins = corsOrigin.split(',').map(o => o.trim());
    console.log(`✅ CORS configured with ${origins.length} allowed origin(s):`);
    origins.forEach(origin => console.log(`   - ${origin}`));
  } else {
    console.log('ℹ️  CORS: Allowing all origins (development mode)');
  }
}
