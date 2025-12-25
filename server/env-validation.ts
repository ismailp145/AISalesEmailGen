/**
 * Environment Variable Validation
 * 
 * Validates required environment variables on application startup.
 * Helps catch configuration errors before the app runs.
 */

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Required environment variables for the application to run
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
] as const;

/**
 * AI provider configuration (at least one required)
 */
const AI_PROVIDERS = [
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'AI_INTEGRATIONS_OPENAI_API_KEY',
] as const;

/**
 * Optional but recommended for production
 */
const RECOMMENDED_VARS = [
  'SESSION_SECRET',
  'CLERK_SECRET_KEY',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET',
] as const;

/**
 * Production-specific requirements
 */
const PRODUCTION_VARS = [
  'SESSION_SECRET',
  'NODE_ENV',
] as const;

/**
 * Validate environment configuration
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Check AI provider (at least one required)
  const hasAIProvider = AI_PROVIDERS.some(varName => process.env[varName]);
  if (!hasAIProvider) {
    errors.push(
      `Missing AI provider configuration. Set one of: ${AI_PROVIDERS.join(', ')}`
    );
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]) {
      warnings.push(`Recommended environment variable not set: ${varName}`);
    }
  }

  // Production-specific checks
  if (isProduction) {
    for (const varName of PRODUCTION_VARS) {
      if (!process.env[varName]) {
        errors.push(`Missing required production variable: ${varName}`);
      }
    }

    // Check session secret strength
    const sessionSecret = process.env.SESSION_SECRET;
    if (sessionSecret && sessionSecret.length < 32) {
      warnings.push('SESSION_SECRET should be at least 32 characters for security');
    }

    // Check for development keys in production
    if (process.env.STRIPE_SECRET_KEY?.includes('test')) {
      warnings.push('Using Stripe test key in production - switch to live key');
    }

    if (process.env.CLERK_SECRET_KEY?.includes('test')) {
      warnings.push('Using Clerk test key in production - switch to live key');
    }

    // Check CORS configuration
    if (!process.env.CORS_ORIGIN) {
      warnings.push('CORS_ORIGIN not set in production - this is a security risk');
    }

    // Check for rate limiting configuration
    if (!process.env.RATE_LIMIT_WINDOW_MS && !process.env.RATE_LIMIT_MAX_REQUESTS) {
      warnings.push('Rate limiting not configured - consider adding for production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log environment validation results
 */
export function logEnvironmentValidation(): void {
  console.log('\n========================================');
  console.log('Environment Variable Validation');
  console.log('========================================\n');

  const result = validateEnvironment();

  if (result.errors.length > 0) {
    console.error('❌ ERRORS:');
    result.errors.forEach(error => console.error(`   ${error}`));
    console.error('');
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  WARNINGS:');
    result.warnings.forEach(warning => console.warn(`   ${warning}`));
    console.warn('');
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log('✅ All environment variables validated successfully\n');
  } else if (result.isValid) {
    console.log('✅ Required variables present (see warnings above)\n');
  } else {
    console.error('❌ Environment validation failed - see errors above\n');
  }

  console.log('========================================\n');

  // Exit if there are critical errors
  if (!result.isValid) {
    console.error('Cannot start application due to missing required environment variables.');
    console.error('Please check .env.example for required configuration.');
    process.exit(1);
  }
}

/**
 * Get environment info for logging (without exposing secrets)
 */
export function getEnvironmentInfo(): Record<string, string> {
  const maskSecret = (value: string | undefined): string => {
    if (!value) return 'not set';
    if (value.length <= 8) return '***';
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  };

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not set',
    OPENAI_API_KEY: maskSecret(process.env.OPENAI_API_KEY),
    OPENROUTER_API_KEY: maskSecret(process.env.OPENROUTER_API_KEY),
    STRIPE_SECRET_KEY: maskSecret(process.env.STRIPE_SECRET_KEY),
    CLERK_SECRET_KEY: maskSecret(process.env.CLERK_SECRET_KEY),
    SENDGRID_API_KEY: maskSecret(process.env.SENDGRID_API_KEY),
    FIRECRAWL_API_KEY: maskSecret(process.env.FIRECRAWL_API_KEY),
    HUBSPOT_API_KEY: maskSecret(process.env.HUBSPOT_API_KEY),
  };
}

/**
 * Check if specific feature is configured
 */
export function isFeatureConfigured(feature: string): boolean {
  const featureChecks: Record<string, () => boolean> = {
    stripe: () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID),
    clerk: () => !!(process.env.CLERK_SECRET_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY),
    sendgrid: () => !!process.env.SENDGRID_API_KEY,
    firecrawl: () => !!process.env.FIRECRAWL_API_KEY,
    hubspot: () => !!process.env.HUBSPOT_API_KEY,
    openai: () => !!process.env.OPENAI_API_KEY,
    openrouter: () => !!process.env.OPENROUTER_API_KEY,
  };

  const check = featureChecks[feature.toLowerCase()];
  return check ? check() : false;
}
