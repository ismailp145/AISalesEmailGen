import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { generateEmail, generateEmailsBatch, detectTriggers, extractProfileFromWebsite } from "./openai";
import { sendEmail, isSendGridConfigured, initSendGrid } from "./sendgrid";
import { createHubSpotService } from "./hubspot";
import { SalesforceService, createSalesforceService, isSalesforceConfigured } from "./salesforce";
import { GmailService, createGmailService, isGmailConfigured } from "./gmail";
import { OutlookService, createOutlookService, isOutlookConfigured } from "./outlook";
import { storage } from "./storage";
import { isFirecrawlConfigured, researchCompany, crawlCompanyWebsite } from "./firecrawl";
import {
  isStripeConfigured,
  getStripeConfigStatus,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  handleWebhookEvent,
} from "./stripe";
import { getCurrentUserId } from "./middleware/clerk";
import { normalizeUrl } from "./url-utils";
import { 
  generateEmailRequestSchema, 
  bulkGenerateRequestSchema, 
  userProfileSchema, 
  createSequenceRequestSchema,
  updateSequenceRequestSchema,
  enrollProspectsRequestSchema,
  detectTriggersRequestSchema,
  SUBSCRIPTION_LIMITS,
  type CrmProvider,
  type SequenceStatus,
  type EnrollmentStatus,
  type SubscriptionTier,
} from "@shared/schema";
import { z } from "zod";
import { DEV_USER_HEADER } from "./constants";
import { nanoid } from "nanoid";

/**
 * Sanitize error messages for client responses
 * Prevents leaking sensitive information like stack traces or internal paths
 */
function sanitizeError(error: unknown): { message: string; code?: string } {
  // Known safe error messages can be passed through
  const safeMessages = [
    "Invalid request",
    "Not found",
    "Unauthorized",
    "Forbidden",
    "Rate limit exceeded",
    "Service unavailable",
    "Email limit exceeded",
    "Insufficient email credits",
  ];

  if (error instanceof Error) {
    // Check if it's a safe message
    if (safeMessages.some(msg => error.message.startsWith(msg))) {
      return { message: error.message };
    }
    
    // Normalize message for pattern checks
    const normalizedMessage = error.message.toLowerCase();
    
    // Check for common error patterns that are safe
    if (normalizedMessage.includes("not found")) {
      return { message: "Resource not found" };
    } else if (normalizedMessage.includes("validation") || normalizedMessage.includes("invalid")) {
      return { message: "Invalid request data" };
    }
    
    // For production, return generic message
    if (process.env.NODE_ENV === "production") {
      console.error("[Error] Sanitized error:", error.message);
      return { message: "An unexpected error occurred. Please try again." };
    }
    
    // In development, allow more detail but still sanitize
    return { message: error.message.substring(0, 200) };
  }
  
  return { message: "An unexpected error occurred. Please try again." };
}

// Helper to get user ID with per-session dev fallback when Clerk is not configured.
// This avoids sharing data across unauthenticated users by issuing a unique
// session-scoped identifier instead of a global "anonymous" value.
function getUserIdOrDefault(req: Request): string {
  const userId = getCurrentUserId(req);
  if (userId) return userId;

  // In development (no Clerk configured), allow a dev ID via header or session.
  if (!process.env.CLERK_SECRET_KEY) {
    const headerUserId = req.header(DEV_USER_HEADER) || req.header("x-user-id");
    const session = (req as any).session as { devUserId?: string } | undefined;

    if (headerUserId) {
      const devId = `dev:${headerUserId}`;
      if (session) session.devUserId = devId;
      return devId;
    }

    if (session?.devUserId) {
      return session.devUserId;
    }

    const generated = `dev:${nanoid(10)}`;
    if (session) {
      session.devUserId = generated;
    }
    return generated;
  }

  throw new Error("User ID is required but was not found in the request.");
}

// Initialize SendGrid on module load
initSendGrid();

const sendEmailRequestSchema = z.object({
  to: z.string().email("Invalid recipient email"),
  from: z.string().email("Invalid sender email"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  provider: z.enum(["sendgrid", "gmail", "outlook"]).optional().default("sendgrid"),
});

// Helper to get the base URL for OAuth/Stripe redirects
// For cross-origin deployments (Vercel frontend + Railway backend), 
// we use FRONTEND_URL or CORS_ORIGIN as the redirect destination
function getBaseUrl(req: any): string {
  // In production, use the frontend URL for redirects
  if (process.env.NODE_ENV === 'production') {
    // First priority: explicit FRONTEND_URL env var
    if (process.env.FRONTEND_URL) {
      console.log(`[Redirect] Using FRONTEND_URL: ${process.env.FRONTEND_URL}`);
      return process.env.FRONTEND_URL.replace(/\/$/, ''); // Remove trailing slash
    }
    
    // Second priority: first CORS_ORIGIN (frontend domain)
    const corsOrigin = process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    if (corsOrigin) {
      console.log(`[Redirect] Using CORS_ORIGIN: ${corsOrigin}`);
      return corsOrigin.replace(/\/$/, ''); // Remove trailing slash
    }
    
    // Fallback: require at least one to be configured
    console.error('[Security] CRITICAL: No FRONTEND_URL or CORS_ORIGIN configured for redirects in production.');
    throw new Error('No frontend URL configured for redirects. Please set FRONTEND_URL or CORS_ORIGIN.');
  }
  
  // In development, use the request host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}`;
}

/**
 * Validates website content quality for profile extraction
 * Checks for minimum length, meaningful content indicators, and common error page patterns
 * @param content - The website content (markdown) to validate
 * @returns Object with isValid flag and optional error message
 */
function validateWebsiteContent(content: string | null | undefined): { isValid: boolean; error?: string } {
  // Check if content exists
  if (!content || typeof content !== 'string') {
    return { isValid: false, error: "No content extracted from website" };
  }

  // Minimum length threshold (increased from 100 to 300 characters)
  const MIN_LENGTH = 300;
  if (content.length < MIN_LENGTH) {
    return { 
      isValid: false, 
      error: `Content too short (${content.length} characters). Minimum ${MIN_LENGTH} characters required.` 
    };
  }

  // Check for common error page indicators
  const errorIndicators = [
    /404.*not.*found/i,
    /page.*not.*found/i,
    /error.*404/i,
    /access.*denied/i,
    /forbidden/i,
    /server.*error/i,
    /internal.*error/i,
    /coming.*soon/i,
    /under.*construction/i,
    /domain.*for.*sale/i,
    /this.*domain.*may.*be.*for.*sale/i,
  ];

  const lowerContent = content.toLowerCase();
  for (const pattern of errorIndicators) {
    if (pattern.test(lowerContent)) {
      return { 
        isValid: false, 
        error: "Website appears to be an error page or placeholder" 
      };
    }
  }

  // Check for meaningful content indicators (business-related keywords)
  // This helps filter out pages that are long but contain no useful information
  const meaningfulIndicators = [
    /\b(company|business|product|service|about|contact|team|solution|customer|client)\b/i,
    /\b(we|our|us|they|their)\b/i, // Pronouns indicating descriptive content
    /[a-z]{4,}/i, // At least some longer words (not just short codes/links)
  ];

  const hasMeaningfulContent = meaningfulIndicators.some(pattern => pattern.test(content));
  
  if (!hasMeaningfulContent && content.length < 500) {
    // If content is between 300-500 chars and has no meaningful indicators, reject it
    return { 
      isValid: false, 
      error: "Content does not appear to contain meaningful business information" 
    };
  }

  return { isValid: true };
}

function checkAIIntegration(): { configured: boolean; message?: string } {
  // Check for OpenRouter first, then OpenAI
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  
  if (openRouterKey || openAIKey || (baseUrl && apiKey)) {
    return { configured: true };
  }
  
  return {
    configured: false,
    message: "AI integration is not configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY.",
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check for integrations
  app.get("/api/health", (req, res) => {
    const aiStatus = checkAIIntegration();
    return res.json({
      status: "ok",
      ai: aiStatus.configured ? "configured" : "not configured",
      firecrawl: isFirecrawlConfigured() ? "configured" : "not configured",
      sendgrid: isSendGridConfigured() ? "configured" : "not configured",
      salesforce: isSalesforceConfigured() ? "configured" : "not configured",
      gmail: isGmailConfigured() ? "configured" : "not configured",
      outlook: isOutlookConfigured() ? "configured" : "not configured",
      stripe: isStripeConfigured() ? "configured" : "not configured",
    });
  });

  // ============================================
  // Email Generation Endpoints
  // ============================================

  // Single email generation endpoint
  app.post("/api/generate-email", async (req, res) => {
    try {
      const aiStatus = checkAIIntegration();
      if (!aiStatus.configured) {
        return res.status(503).json({
          error: "Service unavailable",
          message: aiStatus.message,
        });
      }

      const parsed = generateEmailRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.flatten() 
        });
      }

      const { prospect, tone, length, triggers } = parsed.data;
      const linkedinContent = (req.body as any).linkedinContent;
      const userId = getUserIdOrDefault(req);
      
      // Check email limits (considering free trial)
      const limitCheck = await storage.checkEmailLimit(userId);
      const trialStatus = await storage.checkFreeTrialStatus(userId);
      
      // Determine effective limit based on free trial status
      let effectiveLimit = limitCheck.limit;
      let effectiveTier: SubscriptionTier = limitCheck.tier;
      
      if (trialStatus.isActive && limitCheck.tier === "free") {
        effectiveLimit = SUBSCRIPTION_LIMITS.pro.emailsPerMonth;
        effectiveTier = "pro";
      }
      
      if (limitCheck.used >= effectiveLimit) {
        const tierDisplay = effectiveTier === "free" ? "Free" : effectiveTier === "pro" ? "Pro" : "Enterprise";
        return res.status(403).json({
          error: "Email limit exceeded",
          message: `You've reached your monthly limit of ${effectiveLimit} emails on the ${tierDisplay} plan.`,
          used: limitCheck.used,
          limit: effectiveLimit,
          tier: effectiveTier,
          upgradeUrl: "/settings",
          isTrialUser: trialStatus.isActive,
        });
      }
      
      const email = await generateEmail({ prospect, tone, length, triggers, linkedinContent, userId });
      
      // Increment email usage
      await storage.incrementEmailUsage(userId);
      
      // Save to email activities table
      try {
        await storage.saveEmailActivity({
          userId,
          prospectEmail: prospect.email,
          prospectName: `${prospect.firstName} ${prospect.lastName}`,
          prospectCompany: prospect.company,
          subject: email.subject,
          body: email.body,
          tone,
          length,
          status: "generated",
        });
      } catch (saveError) {
        console.error("Failed to save email activity:", saveError);
        // Don't fail the request if save fails
      }
      
      return res.json(email);
    } catch (error: any) {
      console.error("Email generation error:", error);
      
      const isRateLimitError = error?.message?.includes("429") || 
                               error?.message?.toLowerCase()?.includes("rate limit");
      
      if (isRateLimitError) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          message: "Too many requests. Please wait a moment and try again.",
        });
      }

      return res.status(500).json({
        error: "Failed to generate email",
        message: error?.message || "An unexpected error occurred. Please try again.",
      });
    }
  });

  // Detect triggers for a prospect
  app.post("/api/detect-triggers", async (req, res) => {
    try {
      const aiStatus = checkAIIntegration();
      if (!aiStatus.configured) {
        return res.status(503).json({
          error: "Service unavailable",
          message: aiStatus.message,
        });
      }

      // Normalize companyWebsite if provided
      const rawCompanyWebsite = req.body?.companyWebsite;
      let normalizedWebsite: string | undefined;
      
      if (rawCompanyWebsite && rawCompanyWebsite.trim()) {
        try {
          normalizedWebsite = normalizeUrl(rawCompanyWebsite);
        } catch (error) {
          return res.status(400).json({
            error: "Invalid URL",
            message: error instanceof Error ? error.message : "The provided URL is not allowed for security reasons.",
          });
        }
      } else {
        normalizedWebsite = rawCompanyWebsite;
      }

      // Validate with normalized URL
      const parsed = detectTriggersRequestSchema.safeParse({
        ...req.body,
        companyWebsite: normalizedWebsite,
      });
      
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const errorMessages: string[] = [];
        
        if (errors.companyWebsite) {
          errorMessages.push(`Website: ${errors.companyWebsite[0]}`);
        }
        if (errors.prospect) {
          if (Array.isArray(errors.prospect)) {
            // prospect is a flat field, just an array of error messages
            errors.prospect.forEach((msg) => {
              if (msg) errorMessages.push(`Prospect: ${msg}`);
            });
          } else if (typeof errors.prospect === "object" && errors.prospect !== null) {
            // prospect is a nested object, iterate over its fields
            Object.entries(errors.prospect).forEach(([field, messages]) => {
              const firstMessage = Array.isArray(messages) ? messages[0] : undefined;
              if (firstMessage) {
                errorMessages.push(`${field}: ${firstMessage}`);
              }
            });
          }
        }
        
        return res.status(400).json({ 
          error: "Invalid request",
          message: errorMessages.join(". ") || "Please check your input and try again.",
          details: parsed.error.flatten() 
        });
      }

      const { prospect, companyWebsite } = parsed.data;
      
      // Prepare company data for trigger detection
      let companyData: {
        websiteInfo?: string;
        recentNews?: Array<{ title: string; description: string; source: string; date: string }>;
      } | undefined;

      // If Firecrawl is configured and we have company info, research the company
      if (isFirecrawlConfigured() && (companyWebsite || prospect.company)) {
        try {
          console.log("[API] Researching company with Firecrawl:", prospect.company);
          
          const research = await researchCompany(
            prospect.company,
            companyWebsite || undefined
          );

          // FIX: Only include recentNews if there are actual news items
          companyData = {
            websiteInfo: research.websiteData?.content,
            // Only include recentNews if we actually found news
            ...(research.newsData.newsItems.length > 0 && {
              recentNews: research.newsData.newsItems.map(news => ({
                title: news.title,
                description: news.description,
                source: news.source || "Unknown",
                date: news.publishedDate || "Recent",
              })),
            }),
          };

          console.log("[API] Company research completed:", {
            hasWebsiteData: !!research.websiteData,
            newsCount: research.newsData.newsItems.length,
            firecrawlSearched: true, // Track that we attempted Firecrawl
          });
        } catch (firecrawlError: any) {
          // Log error but continue with trigger detection without company data
          console.error("[API] Firecrawl error (continuing without company data):", firecrawlError?.message);
        }
      }

      const result = await detectTriggers(prospect, companyData);
      
      return res.json(result);
    } catch (error: any) {
      console.error("Trigger detection error:", error);
      
      return res.status(500).json({ 
        error: "Failed to detect triggers",
        message: error?.message || "An unexpected error occurred. Please try again."
      });
    }
  });

  // Bulk email generation endpoint
  app.post("/api/generate-emails-bulk", async (req, res) => {
    try {
      const aiStatus = checkAIIntegration();
      if (!aiStatus.configured) {
        return res.status(503).json({
          error: "Service unavailable",
          message: aiStatus.message,
        });
      }

      const parsed = bulkGenerateRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.flatten() 
        });
      }

      const { prospects, tone, length } = parsed.data;
      const userId = getUserIdOrDefault(req);
      
      // Check email limits for bulk (considering free trial)
      const limitCheck = await storage.checkEmailLimit(userId);
      const trialStatus = await storage.checkFreeTrialStatus(userId);
      
      // Determine effective limit based on free trial status
      let effectiveLimit = limitCheck.limit;
      let effectiveTier: SubscriptionTier = limitCheck.tier;
      
      if (trialStatus.isActive && limitCheck.tier === "free") {
        effectiveLimit = SUBSCRIPTION_LIMITS.pro.emailsPerMonth;
        effectiveTier = "pro";
      }
      
      const remaining = effectiveLimit - limitCheck.used;
      
      // Check if user has enough credits for this batch
      if (prospects.length > remaining) {
        return res.status(403).json({
          error: "Insufficient email credits",
          message: `You can only generate ${remaining} more emails this month. Requested: ${prospects.length}`,
          used: limitCheck.used,
          limit: effectiveLimit,
          remaining,
          requested: prospects.length,
          tier: effectiveTier,
          upgradeUrl: "/settings",
          isTrialUser: trialStatus.isActive,
        });
      }
      
      
      const batchInput = prospects.map((prospect) => ({
        prospect,
        tone,
        length,
        userId,
      }));

      const results = await generateEmailsBatch(batchInput);
      
      const response = prospects.map((prospect, index) => ({
        prospect,
        ...(results[index].email && { email: results[index].email }),
        ...(results[index].error && { error: results[index].error }),
        status: results[index].email ? "ready" : "error",
      }));

      // Count successful generations and increment usage
      let successCount = 0;
      
      // Save all generated emails
      for (let i = 0; i < response.length; i++) {
        const item = response[i];
        if (item.email) {
          successCount++;
          try {
            await storage.saveEmailActivity({
              userId,
              prospectEmail: item.prospect.email,
              prospectName: `${item.prospect.firstName} ${item.prospect.lastName}`,
              prospectCompany: item.prospect.company,
              subject: item.email.subject,
              body: item.email.body,
              tone,
              length,
              status: "generated",
            });
          } catch (saveError) {
            console.error("Failed to save email activity:", saveError);
          }
        }
      }
      
      // Increment email usage for successful generations
      for (let i = 0; i < successCount; i++) {
        await storage.incrementEmailUsage(userId);
      }

      return res.json(response);
    } catch (error: any) {
      console.error("Bulk email generation error:", error);
      return res.status(500).json({ 
        error: "Failed to generate emails",
        message: error?.message || "An unexpected error occurred. Please try again."
      });
    }
  });

  // ============================================
  // Email Sending Endpoints
  // ============================================

  // Send email endpoint (multi-provider)
  app.post("/api/send-email", async (req, res) => {
    try {
      const parsed = sendEmailRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.flatten() 
        });
      }

      const { to, from, subject, body, provider } = parsed.data;
      
      const userId = getUserIdOrDefault(req);
      let result: { success: boolean; error?: string; messageId?: string };

      if (provider === "gmail") {
        // Get Gmail connection
        const connection = await storage.getCrmConnection(userId, "gmail" as any);
        if (!connection || !connection.accessToken) {
          return res.status(503).json({
            error: "Gmail not connected",
            message: "Please connect your Gmail account first.",
          });
        }
        
        const gmail = createGmailService(
          connection.accessToken,
          connection.refreshToken || undefined,
          // Persist refreshed tokens to database
          async (newAccessToken) => {
            await storage.saveCrmConnection(userId, "gmail" as CrmProvider, {
              accessToken: newAccessToken,
              refreshToken: connection.refreshToken || undefined,
              accountName: connection.accountName || undefined,
            });
          }
        );
        result = await gmail.sendEmail({ to, from, subject, body });
      } else if (provider === "outlook") {
        // Get Outlook connection
        const connection = await storage.getCrmConnection(userId, "outlook" as any);
        if (!connection || !connection.accessToken) {
          return res.status(503).json({
            error: "Outlook not connected",
            message: "Please connect your Outlook account first.",
          });
        }
        
        const outlook = createOutlookService(
          connection.accessToken,
          connection.refreshToken || undefined,
          // Persist refreshed tokens to database
          async (newAccessToken) => {
            await storage.saveCrmConnection(userId, "outlook" as CrmProvider, {
              accessToken: newAccessToken,
              refreshToken: connection.refreshToken || undefined,
              accountName: connection.accountName || undefined,
            });
          }
        );
        result = await outlook.sendEmail({ to, subject, body });
      } else {
        // Default to SendGrid
        if (!isSendGridConfigured()) {
          return res.status(503).json({
            error: "Service unavailable",
            message: "SendGrid is not configured. Add SENDGRID_API_KEY to your Secrets.",
          });
        }
        result = await sendEmail({ to, from, subject, body });
      }

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to send email",
          message: result.error,
        });
      }

      // Update email status in database
      try {
        await storage.updateEmailActivityStatus(userId, to, subject, "sent", provider);
      } catch (updateError) {
        console.error("Failed to update email status:", updateError);
      }

      return res.json({ success: true, message: "Email sent successfully", provider });
    } catch (error: any) {
      console.error("Send email error:", error);
      return res.status(500).json({ 
        error: "Failed to send email",
        message: error?.message || "An unexpected error occurred."
      });
    }
  });

  // ============================================
  // Email History Endpoints
  // ============================================

  // Get all email activities
  app.get("/api/emails", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;
      
      const emails = await storage.getEmailActivities(userId, limit, offset, status);
      return res.json(emails);
    } catch (error: any) {
      console.error("Get emails error:", error);
      return res.status(500).json({
        error: "Failed to get emails",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Get single email activity
  app.get("/api/emails/:id", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid email ID" });
      }

      const email = await storage.getEmailActivity(userId, id);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }

      return res.json(email);
    } catch (error: any) {
      console.error("Get email error:", error);
      return res.status(500).json({
        error: "Failed to get email",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Update email status
  app.patch("/api/emails/:id", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid email ID" });
      }

      const schema = z.object({
        status: z.enum(["generated", "sent", "opened", "replied"]),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      await storage.updateEmailActivityStatusById(userId, id, parsed.data.status);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Update email error:", error);
      return res.status(500).json({
        error: "Failed to update email",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // User Profile Endpoints
  // ============================================

  // Get user profile
  app.get("/api/profile", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const profile = await storage.getUserProfile(userId);
      return res.json(profile);
    } catch (error: any) {
      console.error("Get profile error:", error);
      return res.status(500).json({
        error: "Failed to get profile",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Save user profile
  app.post("/api/profile", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const parsed = userProfileSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const profile = await storage.saveUserProfile(userId, parsed.data);
      return res.json(profile);
    } catch (error: any) {
      console.error("Save profile error:", error);
      return res.status(500).json({
        error: "Failed to save profile",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Auto-fill profile from company website
  app.post("/api/profile/auto-fill", async (req, res) => {
    console.log("[API] POST /api/profile/auto-fill - Request received");
    try {
      const aiStatus = checkAIIntegration();
      if (!aiStatus.configured) {
        return res.status(503).json({
          error: "Service unavailable",
          message: aiStatus.message,
        });
      }

      if (!isFirecrawlConfigured()) {
        return res.status(503).json({
          error: "Firecrawl not configured",
          message: "Firecrawl is required for auto-fill. Please set FIRECRAWL_API_KEY.",
        });
      }

      // Get raw input
      const rawCompanyWebsite = req.body?.companyWebsite;
      const rawCompanyName = req.body?.companyName;

      // Normalize the URL before validation
      let normalizedWebsite = "";
      if (rawCompanyWebsite) {
        try {
          normalizedWebsite = normalizeUrl(rawCompanyWebsite);
        } catch (error) {
          return res.status(400).json({
            error: "Invalid URL",
            message: error instanceof Error ? error.message : "The provided URL is not allowed for security reasons.",
          });
        }
      }

      const schema = z.object({
        companyWebsite: z.string().min(1, "Company website is required").url({
          message: "Please enter a valid website URL (e.g., https://example.com or www.example.com)"
        }),
        companyName: z.string().min(1, "Company name is required"),
      });

      // Validate with normalized URL
      const parsed = schema.safeParse({
        companyWebsite: normalizedWebsite,
        companyName: rawCompanyName,
      });
      
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const errorMessages: string[] = [];
        
        if (errors.companyWebsite) {
          errorMessages.push(`Website: ${errors.companyWebsite[0]}`);
        }
        if (errors.companyName) {
          errorMessages.push(`Company Name: ${errors.companyName[0]}`);
        }
        
        return res.status(400).json({
          error: "Invalid request",
          message: errorMessages.join(". ") || "Please check your input and try again.",
          details: parsed.error.flatten(),
        });
      }

      const { companyWebsite, companyName } = parsed.data;

      console.log("[API] Auto-filling profile from website:", companyWebsite);

      // Crawl the company website
      const websiteContent = await crawlCompanyWebsite(companyWebsite);

      // Validate website content quality
      const validation = validateWebsiteContent(websiteContent);
      if (!validation.isValid) {
        return res.status(400).json({
          error: "Insufficient content",
          message: validation.error || "Could not extract enough meaningful content from the website. Please try a different URL or fill in manually.",
        });
      }

      // Extract profile information using AI
      const extractedProfile = await extractProfileFromWebsite(websiteContent, companyName);

      if (Object.keys(extractedProfile).length === 0) {
        return res.status(400).json({
          error: "No data extracted",
          message: "Could not extract profile information from the website. Please fill in manually.",
        });
      }

      console.log("[API] Successfully extracted", Object.keys(extractedProfile).length, "profile fields");

      return res.json({
        success: true,
        extractedFields: extractedProfile,
        fieldsCount: Object.keys(extractedProfile).length,
      });
    } catch (error: any) {
      console.error("Auto-fill profile error:", error);
      
      return res.status(500).json({
        error: "Failed to auto-fill profile",
        message: error?.message || "An unexpected error occurred. Please try again or fill in manually.",
      });
    }
  });

  // ============================================
  // CRM Integration Endpoints
  // ============================================

  // Get all CRM connections
  app.get("/api/crm/connections", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const connections = await storage.getCrmConnections(userId);
      
      return res.json({
        connections,
        available: {
          hubspot: !!process.env.HUBSPOT_API_KEY,
          salesforce: isSalesforceConfigured(),
          gmail: isGmailConfigured(),
          outlook: isOutlookConfigured(),
        },
      });
    } catch (error: any) {
      console.error("Get CRM connections error:", error);
      return res.status(500).json({
        error: "Failed to get CRM connections",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // HubSpot Endpoints
  // ============================================

  // Test and connect HubSpot
  app.post("/api/crm/hubspot/connect", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const hubspot = createHubSpotService();
      
      if (!hubspot) {
        return res.status(400).json({
          error: "HubSpot not configured",
          message: "Add HUBSPOT_API_KEY to your Secrets to connect HubSpot.",
        });
      }

      const result = await hubspot.testConnection();
      
      if (!result.success) {
        return res.status(400).json({
          error: "Connection failed",
          message: result.error,
        });
      }

      // Save connection to database
      const connection = await storage.saveCrmConnection(userId, "hubspot", {
        accountName: result.accountName,
      });

      return res.json({
        success: true,
        connection,
      });
    } catch (error: any) {
      console.error("HubSpot connect error:", error);
      return res.status(500).json({
        error: "Failed to connect to HubSpot",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Disconnect HubSpot
  app.post("/api/crm/hubspot/disconnect", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      await storage.disconnectCrm(userId, "hubspot");
      return res.json({ success: true });
    } catch (error: any) {
      console.error("HubSpot disconnect error:", error);
      return res.status(500).json({
        error: "Failed to disconnect HubSpot",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Sync contacts from HubSpot
  app.post("/api/crm/hubspot/sync", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const hubspot = createHubSpotService();
      
      if (!hubspot) {
        return res.status(400).json({
          error: "HubSpot not configured",
          message: "Add HUBSPOT_API_KEY to your Secrets to sync contacts.",
        });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const contacts = await hubspot.getContacts(limit);

      if (contacts.length === 0) {
        return res.json({
          success: true,
          synced: 0,
          message: "No contacts found with complete data (email, first name, last name required).",
        });
      }

      // Add userId to each contact before saving
      const contactsWithUserId = contacts.map(c => ({ ...c, userId }));
      
      // Save contacts to database
      const saved = await storage.saveProspects(contactsWithUserId);

      return res.json({
        success: true,
        synced: saved.length,
        prospects: saved,
      });
    } catch (error: any) {
      console.error("HubSpot sync error:", error);
      return res.status(500).json({
        error: "Failed to sync contacts",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Search HubSpot contacts
  app.get("/api/crm/hubspot/search", async (req, res) => {
    try {
      const hubspot = createHubSpotService();
      
      if (!hubspot) {
        return res.status(400).json({
          error: "HubSpot not configured",
          message: "Add HUBSPOT_API_KEY to your Secrets.",
        });
      }

      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({
          error: "Missing query",
          message: "Provide a search query with ?q=",
        });
      }

      const contacts = await hubspot.searchContacts(query);
      return res.json({ contacts });
    } catch (error: any) {
      console.error("HubSpot search error:", error);
      return res.status(500).json({
        error: "Failed to search contacts",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Log email activity to HubSpot
  app.post("/api/crm/hubspot/log-activity", async (req, res) => {
    try {
      const hubspot = createHubSpotService();
      
      if (!hubspot) {
        return res.status(400).json({
          error: "HubSpot not configured",
          message: "Add HUBSPOT_API_KEY to your Secrets.",
        });
      }

      const schema = z.object({
        contactId: z.string(),
        subject: z.string(),
        body: z.string(),
        fromEmail: z.string().email(),
        toEmail: z.string().email(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const result = await hubspot.logEmailActivity(parsed.data.contactId, {
        subject: parsed.data.subject,
        body: parsed.data.body,
        fromEmail: parsed.data.fromEmail,
        toEmail: parsed.data.toEmail,
      });

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to log activity",
          message: result.error,
        });
      }

      return res.json({
        success: true,
        activityId: result.activityId,
      });
    } catch (error: any) {
      console.error("HubSpot log activity error:", error);
      return res.status(500).json({
        error: "Failed to log activity",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // Salesforce Endpoints
  // ============================================

  // Initiate Salesforce OAuth
  app.get("/api/crm/salesforce/auth", (req, res) => {
    try {
      if (!isSalesforceConfigured()) {
        return res.status(400).json({
          error: "Salesforce not configured",
          message: "Add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to your environment.",
        });
      }

      const userId = getUserIdOrDefault(req);
      const baseUrl = getBaseUrl(req);
      const redirectUri = `${baseUrl}/api/crm/salesforce/callback`;
      // Pass userId in state parameter for OAuth callback
      const authUrl = SalesforceService.getAuthUrl(redirectUri) + `&state=${encodeURIComponent(userId)}`;
      
      return res.json({ authUrl });
    } catch (error: any) {
      console.error("Salesforce auth error:", error);
      return res.status(500).json({
        error: "Failed to initiate Salesforce auth",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Salesforce OAuth callback
  app.get("/api/crm/salesforce/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const error = req.query.error as string;
      const state = req.query.state as string; // Contains userId

      if (error) {
        return res.redirect(`/integrations?error=${encodeURIComponent(error)}`);
      }

      if (!code) {
        return res.redirect("/integrations?error=No authorization code received");
      }

      // Get userId from state parameter, fallback to default
      const userId = state || getUserIdOrDefault(req);

      const baseUrl = getBaseUrl(req);
      const redirectUri = `${baseUrl}/api/crm/salesforce/callback`;
      
      const tokens = await SalesforceService.exchangeCodeForTokens(code, redirectUri);
      
      // Create service and test connection
      const salesforce = new SalesforceService(
        tokens.access_token,
        tokens.instance_url,
        tokens.refresh_token
      );
      
      const testResult = await salesforce.testConnection();
      
      if (!testResult.success) {
        return res.redirect(`/integrations?error=${encodeURIComponent(testResult.error || "Connection test failed")}`);
      }

      // Save connection - instanceUrl is required for Salesforce API calls
      await storage.saveCrmConnection(userId, "salesforce", {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accountName: testResult.accountName,
        accountId: tokens.instance_url, // Store instance URL (not userId); this will be saved as 'accountId' in the database (see storage.ts line 279)  
      });

      return res.redirect("/integrations?success=salesforce");
    } catch (error: any) {
      console.error("Salesforce callback error:", error);
      return res.redirect(`/integrations?error=${encodeURIComponent(error?.message || "OAuth failed")}`);
    }
  });

  // Disconnect Salesforce
  app.post("/api/crm/salesforce/disconnect", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      await storage.disconnectCrm(userId, "salesforce");
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Salesforce disconnect error:", error);
      return res.status(500).json({
        error: "Failed to disconnect Salesforce",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Sync contacts from Salesforce
  app.post("/api/crm/salesforce/sync", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const connection = await storage.getCrmConnection(userId, "salesforce");
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({
          error: "Salesforce not connected",
          message: "Please connect your Salesforce account first.",
        });
      }

      const salesforce = createSalesforceService(
        connection.accessToken,
        connection.instanceUrl || "",
        connection.refreshToken || undefined,
        // Persist refreshed tokens to database
        async (newAccessToken) => {
          await storage.saveCrmConnection(userId, "salesforce", {
            accessToken: newAccessToken,
            refreshToken: connection.refreshToken || undefined,
            accountName: connection.accountName || undefined,
            instanceUrl: connection.instanceUrl || undefined,
          });
        }
      );

      const limit = parseInt(req.query.limit as string) || 100;
      const contacts = await salesforce.getContacts(limit);

      if (contacts.length === 0) {
        return res.json({
          success: true,
          synced: 0,
          message: "No contacts found.",
        });
      }

      // Add userId to each contact before saving
      const contactsWithUserId = contacts.map(c => ({ ...c, userId }));
      
      const saved = await storage.saveProspects(contactsWithUserId);

      return res.json({
        success: true,
        synced: saved.length,
        prospects: saved,
      });
    } catch (error: any) {
      console.error("Salesforce sync error:", error);
      return res.status(500).json({
        error: "Failed to sync contacts",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Log email activity to Salesforce
  app.post("/api/crm/salesforce/log-activity", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const connection = await storage.getCrmConnection(userId, "salesforce");
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({
          error: "Salesforce not connected",
          message: "Please connect your Salesforce account first.",
        });
      }

      const schema = z.object({
        contactId: z.string(),
        subject: z.string(),
        body: z.string(),
        fromEmail: z.string().email(),
        toEmail: z.string().email(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const salesforce = createSalesforceService(
        connection.accessToken,
        connection.instanceUrl || "",
        connection.refreshToken || undefined,
        // Persist refreshed tokens to database
        async (newAccessToken) => {
          await storage.saveCrmConnection(userId, "salesforce", {
            accessToken: newAccessToken,
            refreshToken: connection.refreshToken || undefined,
            accountName: connection.accountName || undefined,
            instanceUrl: connection.instanceUrl || undefined,
          });
        }
      );

      const result = await salesforce.logEmailActivity(parsed.data.contactId, {
        subject: parsed.data.subject,
        body: parsed.data.body,
        fromEmail: parsed.data.fromEmail,
        toEmail: parsed.data.toEmail,
      });

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to log activity",
          message: result.error,
        });
      }

      return res.json({
        success: true,
        activityId: result.activityId,
      });
    } catch (error: any) {
      console.error("Salesforce log activity error:", error);
      return res.status(500).json({
        error: "Failed to log activity",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // Gmail Endpoints
  // ============================================

  // Initiate Gmail OAuth
  app.get("/api/email/gmail/auth", (req, res) => {
    try {
      if (!isGmailConfigured()) {
        return res.status(400).json({
          error: "Gmail not configured",
          message: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.",
        });
      }

      const userId = getUserIdOrDefault(req);
      const baseUrl = getBaseUrl(req);
      const redirectUri = `${baseUrl}/api/email/gmail/callback`;
      // Pass userId in state parameter for OAuth callback
      const authUrl = GmailService.getAuthUrl(redirectUri) + `&state=${encodeURIComponent(userId)}`;
      
      return res.json({ authUrl });
    } catch (error: any) {
      console.error("Gmail auth error:", error);
      return res.status(500).json({
        error: "Failed to initiate Gmail auth",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Gmail OAuth callback
  app.get("/api/email/gmail/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const error = req.query.error as string;
      const state = req.query.state as string; // Contains userId

      if (error) {
        return res.redirect(`/integrations?error=${encodeURIComponent(error)}`);
      }

      if (!code) {
        return res.redirect("/integrations?error=No authorization code received");
      }

      // Get userId from state parameter, fallback to default
      const userId = state || getUserIdOrDefault(req);

      const baseUrl = getBaseUrl(req);
      const redirectUri = `${baseUrl}/api/email/gmail/callback`;
      
      const tokens = await GmailService.exchangeCodeForTokens(code, redirectUri);
      
      // Create service and test connection
      const gmail = new GmailService(tokens.access_token, tokens.refresh_token);
      const testResult = await gmail.testConnection();
      
      if (!testResult.success) {
        return res.redirect(`/integrations?error=${encodeURIComponent(testResult.error || "Connection test failed")}`);
      }

      // Save connection (using 'gmail' as provider in crmConnections)
      await storage.saveCrmConnection(userId, "gmail" as CrmProvider, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accountName: testResult.email,
        accountId: testResult.email,
      });

      return res.redirect("/integrations?success=gmail");
    } catch (error: any) {
      console.error("Gmail callback error:", error);
      return res.redirect(`/integrations?error=${encodeURIComponent(error?.message || "OAuth failed")}`);
    }
  });

  // Disconnect Gmail
  app.post("/api/email/gmail/disconnect", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      await storage.disconnectCrm(userId, "gmail" as CrmProvider);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Gmail disconnect error:", error);
      return res.status(500).json({
        error: "Failed to disconnect Gmail",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Send email via Gmail
  app.post("/api/email/gmail/send", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const connection = await storage.getCrmConnection(userId, "gmail" as CrmProvider);
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({
          error: "Gmail not connected",
          message: "Please connect your Gmail account first.",
        });
      }

      const schema = z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        replyTo: z.string().email().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const gmail = createGmailService(
        connection.accessToken,
        connection.refreshToken || undefined,
        // Persist refreshed tokens to database
        async (newAccessToken) => {
          await storage.saveCrmConnection(userId, "gmail" as CrmProvider, {
            accessToken: newAccessToken,
            refreshToken: connection.refreshToken || undefined,
            accountName: connection.accountName || undefined,
          });
        }
      );

      const result = await gmail.sendEmail({
        to: parsed.data.to,
        from: connection.accountName || "",
        subject: parsed.data.subject,
        body: parsed.data.body,
        replyTo: parsed.data.replyTo,
      });

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to send email",
          message: result.error,
        });
      }

      return res.json({
        success: true,
        messageId: result.messageId,
      });
    } catch (error: any) {
      console.error("Gmail send error:", error);
      return res.status(500).json({
        error: "Failed to send email",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // Outlook Endpoints
  // ============================================

  // Initiate Outlook OAuth
  app.get("/api/email/outlook/auth", (req, res) => {
    try {
      if (!isOutlookConfigured()) {
        return res.status(400).json({
          error: "Outlook not configured",
          message: "Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to your environment.",
        });
      }

      const userId = getUserIdOrDefault(req);
      const baseUrl = getBaseUrl(req);
      const redirectUri = `${baseUrl}/api/email/outlook/callback`;
      // Pass userId in state parameter for OAuth callback
      const authUrl = OutlookService.getAuthUrl(redirectUri) + `&state=${encodeURIComponent(userId)}`;
      
      return res.json({ authUrl });
    } catch (error: any) {
      console.error("Outlook auth error:", error);
      return res.status(500).json({
        error: "Failed to initiate Outlook auth",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Outlook OAuth callback
  app.get("/api/email/outlook/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const error = req.query.error as string;
      const state = req.query.state as string; // Contains userId

      if (error) {
        return res.redirect(`/integrations?error=${encodeURIComponent(error)}`);
      }

      if (!code) {
        return res.redirect("/integrations?error=No authorization code received");
      }

      // Get userId from state parameter, fallback to default
      const userId = state || getUserIdOrDefault(req);

      const baseUrl = getBaseUrl(req);
      const redirectUri = `${baseUrl}/api/email/outlook/callback`;
      
      const tokens = await OutlookService.exchangeCodeForTokens(code, redirectUri);
      
      // Create service and test connection
      const outlook = new OutlookService(tokens.access_token, tokens.refresh_token);
      const testResult = await outlook.testConnection();
      
      if (!testResult.success) {
        return res.redirect(`/integrations?error=${encodeURIComponent(testResult.error || "Connection test failed")}`);
      }

      // Save connection (using 'outlook' as provider in crmConnections)
      await storage.saveCrmConnection(userId, "outlook" as CrmProvider, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accountName: testResult.email,
        accountId: testResult.email,
      });

      return res.redirect("/integrations?success=outlook");
    } catch (error: any) {
      console.error("Outlook callback error:", error);
      return res.redirect(`/integrations?error=${encodeURIComponent(error?.message || "OAuth failed")}`);
    }
  });

  // Disconnect Outlook
  app.post("/api/email/outlook/disconnect", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      await storage.disconnectCrm(userId, "outlook" as CrmProvider);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Outlook disconnect error:", error);
      return res.status(500).json({
        error: "Failed to disconnect Outlook",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Send email via Outlook
  app.post("/api/email/outlook/send", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const connection = await storage.getCrmConnection(userId, "outlook" as CrmProvider);
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({
          error: "Outlook not connected",
          message: "Please connect your Outlook account first.",
        });
      }

      const schema = z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        replyTo: z.string().email().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const outlook = createOutlookService(
        connection.accessToken,
        connection.refreshToken || undefined,
        // Persist refreshed tokens to database
        async (newAccessToken) => {
          await storage.saveCrmConnection(userId, "outlook" as CrmProvider, {
            accessToken: newAccessToken,
            refreshToken: connection.refreshToken || undefined,
            accountName: connection.accountName || undefined,
          });
        }
      );

      const result = await outlook.sendEmail({
        to: parsed.data.to,
        subject: parsed.data.subject,
        body: parsed.data.body,
        replyTo: parsed.data.replyTo,
      });

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to send email",
          message: result.error,
        });
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Outlook send error:", error);
      return res.status(500).json({
        error: "Failed to send email",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // Prospect Endpoints
  // ============================================

  // Get all synced prospects (scoped to user)
  app.get("/api/prospects", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const source = req.query.source as CrmProvider | undefined;
      
      let prospects;
      if (source) {
        prospects = await storage.getProspectsByCrmSource(userId, source);
      } else {
        prospects = await storage.getAllProspects(userId);
      }

      return res.json(prospects);
    } catch (error: any) {
      console.error("Get prospects error:", error);
      return res.status(500).json({
        error: "Failed to get prospects",
        ...sanitizeError(error),
      });
    }
  });

  // ============================================
  // Sequence Endpoints
  // ============================================

  // Get all sequences
  app.get("/api/sequences", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const sequences = await storage.getAllSequences(userId);
      return res.json(sequences);
    } catch (error: any) {
      console.error("Get sequences error:", error);
      return res.status(500).json({
        error: "Failed to get sequences",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Create a new sequence
  app.post("/api/sequences", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const parsed = createSequenceRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const sequence = await storage.createSequence(userId, parsed.data);
      return res.status(201).json(sequence);
    } catch (error: any) {
      console.error("Create sequence error:", error);
      return res.status(500).json({
        error: "Failed to create sequence",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Get a single sequence with steps
  app.get("/api/sequences/:id", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const sequence = await storage.getSequence(userId, id);
      if (!sequence) {
        return res.status(404).json({ error: "Sequence not found" });
      }

      return res.json(sequence);
    } catch (error: any) {
      console.error("Get sequence error:", error);
      return res.status(500).json({
        error: "Failed to get sequence",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Update a sequence
  app.patch("/api/sequences/:id", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const parsed = updateSequenceRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const { steps, ...sequenceData } = parsed.data;

      // Update sequence data
      if (Object.keys(sequenceData).length > 0) {
        await storage.updateSequence(userId, id, sequenceData);
      }

      // Update steps if provided
      if (steps) {
        await storage.updateSequenceSteps(id, steps.map(s => ({
          sequenceId: id,
          stepNumber: s.stepNumber,
          delayDays: s.delayDays,
          sendTimeHour: s.sendTimeHour ?? 9,
          sendTimeMinute: s.sendTimeMinute ?? 0,
          subjectTemplate: s.subjectTemplate || null,
          bodyTemplate: s.bodyTemplate || null,
          isFollowUp: s.isFollowUp ?? false,
        })));
      }

      const updated = await storage.getSequence(userId, id);
      return res.json(updated);
    } catch (error: any) {
      console.error("Update sequence error:", error);
      return res.status(500).json({
        error: "Failed to update sequence",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Update sequence status (activate/pause/archive)
  app.patch("/api/sequences/:id/status", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const schema = z.object({
        status: z.enum(["draft", "active", "paused", "archived"]),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const sequence = await storage.updateSequenceStatus(userId, id, parsed.data.status as SequenceStatus);
      if (!sequence) {
        return res.status(404).json({ error: "Sequence not found" });
      }

      return res.json(sequence);
    } catch (error: any) {
      console.error("Update sequence status error:", error);
      return res.status(500).json({
        error: "Failed to update sequence status",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Delete a sequence
  app.delete("/api/sequences/:id", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const deleted = await storage.deleteSequence(userId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Sequence not found" });
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Delete sequence error:", error);
      return res.status(500).json({
        error: "Failed to delete sequence",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // Enrollment Endpoints
  // ============================================

  // Get enrollments for a sequence
  app.get("/api/sequences/:id/enrollments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const enrollments = await storage.getEnrollments(id);
      return res.json(enrollments);
    } catch (error: any) {
      console.error("Get enrollments error:", error);
      return res.status(500).json({
        error: "Failed to get enrollments",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Enroll prospects in a sequence
  app.post("/api/sequences/:id/enroll", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const parsed = enrollProspectsRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      // Verify sequence exists and belongs to user
      const sequence = await storage.getSequence(userId, id);
      if (!sequence) {
        return res.status(404).json({ error: "Sequence not found" });
      }

      const enrollments = await storage.enrollProspects(id, parsed.data.prospectIds);
      return res.status(201).json(enrollments);
    } catch (error: any) {
      console.error("Enroll prospects error:", error);
      return res.status(500).json({
        error: "Failed to enroll prospects",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Update enrollment status
  app.patch("/api/enrollments/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid enrollment ID" });
      }

      const schema = z.object({
        status: z.enum(["active", "paused", "completed", "replied", "bounced", "unsubscribed"]),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const enrollment = await storage.updateEnrollmentStatus(id, parsed.data.status as EnrollmentStatus);
      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      // If marked as replied, cancel pending emails
      if (parsed.data.status === "replied") {
        await storage.cancelScheduledEmails(id);
      }

      return res.json(enrollment);
    } catch (error: any) {
      console.error("Update enrollment status error:", error);
      return res.status(500).json({
        error: "Failed to update enrollment status",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Mark enrollment as replied (auto-stop)
  app.post("/api/enrollments/:id/replied", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid enrollment ID" });
      }

      await storage.markAsReplied(id);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Mark as replied error:", error);
      return res.status(500).json({
        error: "Failed to mark as replied",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Get scheduled emails for an enrollment
  app.get("/api/enrollments/:id/emails", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid enrollment ID" });
      }

      const emails = await storage.getScheduledEmails(id);
      return res.json(emails);
    } catch (error: any) {
      console.error("Get scheduled emails error:", error);
      return res.status(500).json({
        error: "Failed to get scheduled emails",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // Stripe Subscription Endpoints
  // ============================================

  // Get subscription status
  app.get("/api/subscription", async (req, res) => {
    try {
      const userId = getUserIdOrDefault(req);
      let subscription = await storage.getSubscriptionInfo(userId);
      const limits = await storage.checkEmailLimit(userId);
      let trialStatus = await storage.checkFreeTrialStatus(userId);
      
      // Auto-start free trial for new users who don't have one
      if (!subscription.freeTrialStartedAt && subscription.subscriptionTier === "free") {
        trialStatus = await storage.startFreeTrial(userId);
        // Refresh subscription info
        subscription = await storage.getSubscriptionInfo(userId);
      }
      
      // Calculate effective limits considering free trial
      let effectiveLimit = limits.limit;
      let effectiveTier = limits.tier;
      
      if (trialStatus.isActive && limits.tier === "free") {
        effectiveLimit = SUBSCRIPTION_LIMITS.pro.emailsPerMonth;
        effectiveTier = "pro" as const;
      }
      
      return res.json({
        ...subscription,
        limits: {
          emailsUsed: limits.used,
          emailsLimit: effectiveLimit,
          tier: effectiveTier,
        },
        freeTrial: {
          isActive: trialStatus.isActive,
          daysRemaining: trialStatus.daysRemaining,
          hasExpired: trialStatus.hasExpired,
          endsAt: trialStatus.endsAt,
        },
      });
    } catch (error: any) {
      console.error("Get subscription error:", error);
      return res.status(500).json({
        error: "Failed to get subscription",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Create Stripe Checkout session for Pro subscription
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const configStatus = getStripeConfigStatus();
      
      if (!isStripeConfigured()) {
        const missingKeys: string[] = [];
        if (!configStatus.hasSecretKey) missingKeys.push("STRIPE_SECRET_KEY");
        if (!configStatus.hasPriceId) missingKeys.push("STRIPE_PRO_PRICE_ID");
        
        return res.status(503).json({
          error: "Stripe not configured",
          message: `Stripe is not configured. Missing: ${missingKeys.join(", ")}`,
        });
      }

      const userId = getUserIdOrDefault(req);
      const subscription = await storage.getSubscriptionInfo(userId);

      // Get user email from Clerk or use a fallback
      let userEmail = req.body.email;
      if (!userEmail) {
        // Try to get from user profile
        const profile = await storage.getUserProfile(userId);
        userEmail = profile.senderEmail || `${userId}@placeholder.email`;
      }

      const baseUrl = getBaseUrl(req);
      const successUrl = `${baseUrl}/settings?subscription=success`;
      const cancelUrl = `${baseUrl}/settings?subscription=cancelled`;

      console.log("[Stripe] Creating checkout session:", { userId, userEmail, baseUrl });

      const result = await createCheckoutSession({
        userId,
        userEmail,
        customerId: subscription.stripeCustomerId,
        successUrl,
        cancelUrl,
      });

      console.log("[Stripe] Checkout session created:", { url: result.url ? "present" : "missing", customerId: result.customerId });

      // Save the customer ID if it's new
      if (result.customerId && result.customerId !== subscription.stripeCustomerId) {
        await storage.updateSubscriptionTier(userId, subscription.subscriptionTier as any, {
          customerId: result.customerId,
        });
      }

      return res.json({ url: result.url });
    } catch (error: any) {
      console.error("Create checkout session error:", error);
      return res.status(500).json({
        error: "Failed to create checkout session",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Create Stripe Customer Portal session for subscription management
  app.post("/api/stripe/create-portal-session", async (req, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({
          error: "Stripe not configured",
          message: "Stripe is not configured.",
        });
      }

      const userId = getUserIdOrDefault(req);
      const subscription = await storage.getSubscriptionInfo(userId);
      
      if (!subscription.stripeCustomerId) {
        return res.status(400).json({
          error: "No subscription found",
          message: "You don't have an active subscription to manage.",
        });
      }

      const baseUrl = getBaseUrl(req);
      const returnUrl = `${baseUrl}/settings`;

      const url = await createPortalSession({
        customerId: subscription.stripeCustomerId,
        returnUrl,
      });

      return res.json({ url });
    } catch (error: any) {
      console.error("Create portal session error:", error);
      return res.status(500).json({
        error: "Failed to create portal session",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // Stripe webhook endpoint
  // Note: This endpoint needs raw body parsing, which should be configured in index.ts
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const signature = req.headers["stripe-signature"] as string;
      
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }

      // Get raw body - Express should be configured to provide this
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        console.error("Stripe webhook: rawBody not available. Make sure raw body parsing is configured.");
        return res.status(400).json({ error: "Raw body not available" });
      }

      const event = constructWebhookEvent(rawBody, signature);
      
      // Check for webhook replay attack
      const alreadyProcessed = await storage.isWebhookProcessed(event.id);
      if (alreadyProcessed) {
        console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
        return res.json({ received: true, status: "already_processed" });
      }

      // Mark webhook as processed before handling to avoid duplicate processing on replay
      try {
        await storage.markWebhookProcessed(event.id, event.type);
      } catch (markError) {
        console.error(
          `[Stripe Webhook] Failed to mark event ${event.id} as processed before handling:`,
          markError
        );
        // Do not process the event if we cannot reliably record it as processed.
        return res.status(500).json({ error: "Failed to persist webhook state" });
      }
      
      const result = await handleWebhookEvent(event);

      console.log(`[Stripe Webhook] Event: ${event.type}, Action: ${result.action}`);

      if (result.action !== "ignored" && result.userId) {
        switch (result.action) {
          case "subscription_created":
          case "subscription_updated":
            await storage.updateSubscriptionTier(result.userId, result.tier || "pro", {
              customerId: result.customerId,
              subscriptionId: result.subscriptionId,
              startsAt: new Date(),
              endsAt: result.currentPeriodEnd,
            });
            console.log(`[Stripe Webhook] Updated subscription for user ${result.userId} to ${result.tier}`);
            break;
            
          case "subscription_deleted":
            await storage.updateSubscriptionTier(result.userId, "free", {
              customerId: result.customerId,
              subscriptionId: undefined,
            });
            console.log(`[Stripe Webhook] Cancelled subscription for user ${result.userId}`);
            break;
            
          case "payment_failed":
            console.log(`[Stripe Webhook] Payment failed for user ${result.userId}`);
            // Optionally: Send notification, downgrade after grace period, etc.
            break;
        }
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      return res.status(400).json({
        error: "Webhook error",
        message: error?.message || "Failed to process webhook",
      });
    }
  });

  return httpServer;
}
