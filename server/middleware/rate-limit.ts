/**
 * Rate Limiting Middleware
 * 
 * This file provides rate limiting configuration to protect API endpoints from abuse.
 * 
 * TO ENABLE:
 * 1. Install express-rate-limit: npm install express-rate-limit
 * 2. Import and use in server/index.ts
 * 3. Configure environment variables as needed
 * 
 * USAGE:
 * import { apiLimiter, strictLimiter } from './middleware/rate-limit';
 * app.use('/api/', apiLimiter);
 * app.use('/api/generate-email', strictLimiter);
 */

// TODO: Uncomment after installing express-rate-limit
import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Allows 100 requests per 15 minutes per IP
 */
export const apiLimiter = () => {
  // TODO: Uncomment after installing express-rate-limit
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });
  
};

/**
 * Strict rate limiter for expensive operations
 * Allows 20 requests per 15 minutes per IP
 * Use for AI generation, bulk operations, etc.
 */
export const strictLimiter = () => {
  // TODO: Uncomment after installing express-rate-limit
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.STRICT_RATE_LIMIT_MAX || '20'), // 20 requests per window
    message: 'Too many generation requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all requests, not just successful ones
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many generation requests. Please try again in a few minutes.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });
};

/**
 * Very strict rate limiter for authentication endpoints
 * Allows 5 requests per 15 minutes per IP
 * Helps prevent brute force attacks
 */
export const authLimiter = () => {
  // TODO: Uncomment after installing express-rate-limit
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many failed authentication attempts. Please try again later.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });
};

// Export types for TypeScript
export type RateLimitMiddleware = ReturnType<typeof apiLimiter>;
