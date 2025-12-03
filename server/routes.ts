import type { Express } from "express";
import { createServer, type Server } from "http";
import { generateEmail, generateEmailsBatch } from "./openai";
import { sendEmail, isSendGridConfigured, initSendGrid } from "./sendgrid";
import { createHubSpotService } from "./hubspot";
import { storage } from "./storage";
import { 
  generateEmailRequestSchema, 
  bulkGenerateRequestSchema, 
  userProfileSchema, 
  createSequenceRequestSchema,
  updateSequenceRequestSchema,
  enrollProspectsRequestSchema,
  type CrmProvider,
  type SequenceStatus,
  type EnrollmentStatus,
} from "@shared/schema";
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

  // Get user profile
  app.get("/api/profile", async (req, res) => {
    try {
      const profile = await storage.getUserProfile();
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
      const parsed = userProfileSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const profile = await storage.saveUserProfile(parsed.data);
      return res.json(profile);
    } catch (error: any) {
      console.error("Save profile error:", error);
      return res.status(500).json({
        error: "Failed to save profile",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // CRM Integration Endpoints
  // ============================================

  // Get all CRM connections
  app.get("/api/crm/connections", async (req, res) => {
    try {
      const connections = await storage.getCrmConnections();
      
      // Check if each CRM is configured via API key
      const hubspotConfigured = !!process.env.HUBSPOT_API_KEY;
      
      return res.json({
        connections,
        available: {
          hubspot: hubspotConfigured,
          salesforce: false, // Not implemented yet
          pipedrive: false, // Not implemented yet
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

  // Test and connect HubSpot
  app.post("/api/crm/hubspot/connect", async (req, res) => {
    try {
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
      const connection = await storage.saveCrmConnection("hubspot", {
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
      await storage.disconnectCrm("hubspot");
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

      // Save contacts to database
      const saved = await storage.saveProspects(contacts);

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

  // Get all synced prospects
  app.get("/api/prospects", async (req, res) => {
    try {
      const source = req.query.source as CrmProvider | undefined;
      
      let prospects;
      if (source) {
        prospects = await storage.getProspectsByCrmSource(source);
      } else {
        prospects = await storage.getAllProspects();
      }

      return res.json(prospects);
    } catch (error: any) {
      console.error("Get prospects error:", error);
      return res.status(500).json({
        error: "Failed to get prospects",
        message: error?.message || "An unexpected error occurred.",
      });
    }
  });

  // ============================================
  // Sequence Endpoints
  // ============================================

  // Get all sequences
  app.get("/api/sequences", async (req, res) => {
    try {
      const sequences = await storage.getAllSequences();
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
      const parsed = createSequenceRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      const sequence = await storage.createSequence(parsed.data);
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const sequence = await storage.getSequence(id);
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
        await storage.updateSequence(id, sequenceData);
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

      const updated = await storage.getSequence(id);
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

      const sequence = await storage.updateSequenceStatus(id, parsed.data.status as SequenceStatus);
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid sequence ID" });
      }

      const deleted = await storage.deleteSequence(id);
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

      // Verify sequence exists and is active
      const sequence = await storage.getSequence(id);
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

  return httpServer;
}
