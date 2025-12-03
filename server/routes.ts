import type { Express } from "express";
import { createServer, type Server } from "http";
import { generateEmail, generateEmailsBatch } from "./openai";
import { sendEmail, isSendGridConfigured, initSendGrid } from "./sendgrid";
import { generateEmailRequestSchema, bulkGenerateRequestSchema } from "@shared/schema";
import { z } from "zod";

// Initialize SendGrid on module load
initSendGrid();

const sendEmailRequestSchema = z.object({
  to: z.string().email("Invalid recipient email"),
  from: z.string().email("Invalid sender email"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
});

function checkAIIntegration(): { configured: boolean; message?: string } {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  
  if (!baseUrl || !apiKey) {
    return {
      configured: false,
      message: "AI integration is not configured. Please ensure the OpenAI integration is set up correctly.",
    };
  }
  return { configured: true };
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
      sendgrid: isSendGridConfigured() ? "configured" : "not configured",
    });
  });

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

      const { prospect, tone, length } = parsed.data;
      const email = await generateEmail({ prospect, tone, length });
      
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
      
      const batchInput = prospects.map((prospect) => ({
        prospect,
        tone,
        length,
      }));

      const results = await generateEmailsBatch(batchInput);
      
      const response = prospects.map((prospect, index) => ({
        prospect,
        ...(results[index].email && { email: results[index].email }),
        ...(results[index].error && { error: results[index].error }),
        status: results[index].email ? "ready" : "error",
      }));

      return res.json(response);
    } catch (error: any) {
      console.error("Bulk email generation error:", error);
      return res.status(500).json({ 
        error: "Failed to generate emails",
        message: error?.message || "An unexpected error occurred. Please try again."
      });
    }
  });

  // Send email endpoint (via SendGrid)
  app.post("/api/send-email", async (req, res) => {
    try {
      if (!isSendGridConfigured()) {
        return res.status(503).json({
          error: "Service unavailable",
          message: "SendGrid is not configured. Add SENDGRID_API_KEY to your Secrets.",
        });
      }

      const parsed = sendEmailRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.flatten() 
        });
      }

      const { to, from, subject, body } = parsed.data;
      const result = await sendEmail({ to, from, subject, body });

      if (!result.success) {
        return res.status(500).json({
          error: "Failed to send email",
          message: result.error,
        });
      }

      return res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Send email error:", error);
      return res.status(500).json({ 
        error: "Failed to send email",
        message: error?.message || "An unexpected error occurred."
      });
    }
  });

  return httpServer;
}
