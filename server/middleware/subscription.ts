import type { Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { getCurrentUserId } from "./clerk";
import { DEV_USER_HEADER } from "../constants";
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from "@shared/schema";

/**
 * Helper to get user ID with fallback for dev mode
 * Similar to getUserIdOrDefault in routes.ts
 */
function getUserId(req: Request): string | null {
  const userId = getCurrentUserId(req);
  if (userId) return userId;

  // In development (no Clerk configured), check for dev ID
  if (!process.env.CLERK_SECRET_KEY) {
    const headerUserId = req.header(DEV_USER_HEADER) || req.header("x-user-id");
    const session = (req as any).session as { devUserId?: string } | undefined;

    if (headerUserId) {
      return `dev:${headerUserId}`;
    }

    if (session?.devUserId) {
      return session.devUserId;
    }
  }

  return null;
}

/**
 * Tier hierarchy for comparison
 */
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * Get effective subscription tier (considering free trial)
 */
async function getEffectiveTier(userId: string): Promise<SubscriptionTier> {
  const subscription = await storage.getSubscriptionInfo(userId);
  const baseTier = subscription.subscriptionTier as SubscriptionTier;
  
  // Check if user is in active free trial
  const trialStatus = await storage.checkFreeTrialStatus(userId);
  
  if (trialStatus.isActive && baseTier === "free") {
    // Free trial grants Pro access
    return "pro";
  }
  
  return baseTier;
}

/**
 * Middleware to require a minimum subscription tier
 * Use this to protect routes that require paid access
 * 
 * @param minTier - Minimum required tier ("free", "pro", or "enterprise")
 * @returns Express middleware
 * 
 * @example
 * // Require Pro tier for bulk operations
 * app.post("/api/bulk-action", requireSubscription("pro"), handler);
 */
export function requireSubscription(minTier: SubscriptionTier): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      
      if (!userId) {
        res.status(401).json({ 
          error: "Unauthorized",
          message: "Please sign in to access this feature.",
        });
        return;
      }

      const effectiveTier = await getEffectiveTier(userId);
      const userTierLevel = TIER_HIERARCHY[effectiveTier];
      const requiredTierLevel = TIER_HIERARCHY[minTier];

      if (userTierLevel < requiredTierLevel) {
        res.status(403).json({
          error: "Subscription required",
          message: `This feature requires a ${minTier} subscription or higher.`,
          currentTier: effectiveTier,
          requiredTier: minTier,
          upgradeUrl: "/settings",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Subscription middleware error:", error);
      res.status(500).json({
        error: "Subscription check failed",
        message: "Unable to verify subscription status. Please try again.",
      });
    }
  };
}

/**
 * Middleware to check email generation limits before allowing the request
 * Should be used on email generation endpoints
 * 
 * @example
 * app.post("/api/generate-email", checkEmailLimit, handler);
 */
export const checkEmailLimit: RequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      res.status(401).json({ 
        error: "Unauthorized",
        message: "Please sign in to generate emails.",
      });
      return;
    }

    // Get limit info considering free trial
    const limitCheck = await storage.checkEmailLimit(userId);
    
    // Check if user is in free trial (which grants pro limits)
    const trialStatus = await storage.checkFreeTrialStatus(userId);
    
    let effectiveLimit = limitCheck.limit;
    let effectiveTier = limitCheck.tier;
    
    if (trialStatus.isActive && limitCheck.tier === "free") {
      // Free trial users get pro limits
      effectiveLimit = SUBSCRIPTION_LIMITS.pro.emailsPerMonth;
      effectiveTier = "pro";
    }
    
    if (limitCheck.used >= effectiveLimit) {
      const tierDisplay = effectiveTier === "free" ? "Free" : effectiveTier === "pro" ? "Pro" : "Enterprise";
      
      res.status(403).json({
        error: "Email limit exceeded",
        message: `You've reached your monthly limit of ${effectiveLimit} emails on the ${tierDisplay} plan.`,
        used: limitCheck.used,
        limit: effectiveLimit,
        tier: effectiveTier,
        upgradeUrl: "/settings",
        isTrialUser: trialStatus.isActive,
      });
      return;
    }

    // Attach limit info to request for use in handlers
    (req as any).emailLimitInfo = {
      used: limitCheck.used,
      limit: effectiveLimit,
      tier: effectiveTier,
      remaining: effectiveLimit - limitCheck.used,
      isTrialUser: trialStatus.isActive,
    };

    next();
  } catch (error) {
    console.error("Email limit check error:", error);
    res.status(500).json({
      error: "Limit check failed",
      message: "Unable to verify email limits. Please try again.",
    });
  }
};

/**
 * Middleware to check bulk operation limits
 * Checks both subscription tier and bulk campaign limits
 */
export const checkBulkLimit: RequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      res.status(401).json({ 
        error: "Unauthorized",
        message: "Please sign in to use bulk operations.",
      });
      return;
    }

    const subscription = await storage.getSubscriptionInfo(userId);
    const baseTier = subscription.subscriptionTier as SubscriptionTier;
    
    // Check free trial
    const trialStatus = await storage.checkFreeTrialStatus(userId);
    const effectiveTier = (trialStatus.isActive && baseTier === "free") ? "pro" : baseTier;
    
    const limits = SUBSCRIPTION_LIMITS[effectiveTier];
    
    // Check if bulk campaigns are allowed (only unlimited is -1)
    if (limits.bulkCampaigns !== -1 && limits.bulkCampaigns <= 0) {
      res.status(403).json({
        error: "Bulk campaigns not available",
        message: "Bulk campaigns require a Pro subscription or higher.",
        currentTier: effectiveTier,
        upgradeUrl: "/settings",
      });
      return;
    }

    // Check email limits for the batch size
    const prospects = req.body?.prospects;
    if (Array.isArray(prospects)) {
      const limitCheck = await storage.checkEmailLimit(userId);
      const effectiveLimit = (trialStatus.isActive && limitCheck.tier === "free") 
        ? SUBSCRIPTION_LIMITS.pro.emailsPerMonth 
        : limitCheck.limit;
      
      const remaining = effectiveLimit - limitCheck.used;
      
      if (prospects.length > remaining) {
        res.status(403).json({
          error: "Insufficient email credits",
          message: `You can only generate ${remaining} more emails this month. Requested: ${prospects.length}`,
          used: limitCheck.used,
          limit: effectiveLimit,
          remaining,
          requested: prospects.length,
          upgradeUrl: "/settings",
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error("Bulk limit check error:", error);
    res.status(500).json({
      error: "Limit check failed",
      message: "Unable to verify limits. Please try again.",
    });
  }
};

/**
 * Middleware to check sequence limits
 */
export const checkSequenceLimit: RequestHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      res.status(401).json({ 
        error: "Unauthorized",
        message: "Please sign in to manage sequences.",
      });
      return;
    }

    const subscription = await storage.getSubscriptionInfo(userId);
    const baseTier = subscription.subscriptionTier as SubscriptionTier;
    
    // Check free trial
    const trialStatus = await storage.checkFreeTrialStatus(userId);
    const effectiveTier = (trialStatus.isActive && baseTier === "free") ? "pro" : baseTier;
    
    const limits = SUBSCRIPTION_LIMITS[effectiveTier];
    
    // Only check on creation (POST)
    if (req.method === "POST") {
      const currentSequences = await storage.getAllSequences(userId);
      
      if (limits.sequences !== -1 && currentSequences.length >= limits.sequences) {
        res.status(403).json({
          error: "Sequence limit reached",
          message: `You've reached your limit of ${limits.sequences} sequences on the ${effectiveTier} plan.`,
          currentCount: currentSequences.length,
          limit: limits.sequences,
          tier: effectiveTier,
          upgradeUrl: "/settings",
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error("Sequence limit check error:", error);
    res.status(500).json({
      error: "Limit check failed",
      message: "Unable to verify limits. Please try again.",
    });
  }
};

