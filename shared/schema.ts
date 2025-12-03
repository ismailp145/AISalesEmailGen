import { z } from "zod";
import { pgTable, text, serial, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// ============================================
// Database Tables (Drizzle ORM)
// ============================================

// User profiles table - stores sender/company info
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  senderName: text("sender_name").notNull(),
  senderTitle: text("sender_title"),
  senderEmail: text("sender_email"),
  calendarLink: text("calendar_link"),
  companyName: text("company_name").notNull(),
  companyWebsite: text("company_website"),
  industry: text("industry"),
  companyDescription: text("company_description"),
  productName: text("product_name"),
  productDescription: text("product_description"),
  valueProposition: text("value_proposition"),
  targetAudience: text("target_audience"),
  painPoints: text("pain_points"),
  differentiators: text("differentiators"),
  socialProof: text("social_proof"),
  commonObjections: text("common_objections"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prospects table - stores prospect data (can be from CSV or CRM)
export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  linkedinUrl: text("linkedin_url"),
  notes: text("notes"),
  crmId: text("crm_id"), // ID from HubSpot/Salesforce
  crmSource: text("crm_source"), // 'hubspot', 'salesforce', 'pipedrive', 'csv'
  crmData: jsonb("crm_data"), // Additional CRM-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email activities table - tracks generated/sent emails
export const emailActivities = pgTable("email_activities", {
  id: serial("id").primaryKey(),
  prospectId: serial("prospect_id").references(() => prospects.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  tone: text("tone").notNull(),
  length: text("length").notNull(),
  status: text("status").notNull().default("generated"), // 'generated', 'sent', 'opened', 'replied'
  sentAt: timestamp("sent_at"),
  crmActivityId: text("crm_activity_id"), // ID of activity pushed to CRM
  crmSyncedAt: timestamp("crm_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CRM connections table - stores OAuth tokens and connection state
export const crmConnections = pgTable("crm_connections", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // 'hubspot', 'salesforce', 'pipedrive'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  accountId: text("account_id"), // HubSpot portal ID, Salesforce org ID, etc.
  accountName: text("account_name"),
  isActive: text("is_active").notNull().default("true"),
  lastSyncAt: timestamp("last_sync_at"),
  syncSettings: jsonb("sync_settings"), // What to sync, filters, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const prospectsRelations = relations(prospects, ({ many }) => ({
  emailActivities: many(emailActivities),
}));

export const emailActivitiesRelations = relations(emailActivities, ({ one }) => ({
  prospect: one(prospects, {
    fields: [emailActivities.prospectId],
    references: [prospects.id],
  }),
}));

// Insert schemas
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProspectSchema = createInsertSchema(prospects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailActivitySchema = createInsertSchema(emailActivities).omit({ id: true, createdAt: true });
export const insertCrmConnectionSchema = createInsertSchema(crmConnections).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type UserProfileRecord = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type ProspectRecord = typeof prospects.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type EmailActivityRecord = typeof emailActivities.$inferSelect;
export type InsertEmailActivity = z.infer<typeof insertEmailActivitySchema>;
export type CrmConnectionRecord = typeof crmConnections.$inferSelect;
export type InsertCrmConnection = z.infer<typeof insertCrmConnectionSchema>;

// ============================================
// Zod Schemas (for API validation)
// ============================================

// User profile schema for sender information (API validation)
export const userProfileSchema = z.object({
  senderName: z.string().min(1, "Name is required"),
  senderTitle: z.string().optional().default(""),
  senderEmail: z.string().email("Invalid email").optional().or(z.literal("")).default(""),
  calendarLink: z.string().url("Invalid URL").optional().or(z.literal("")).default(""),
  companyName: z.string().min(1, "Company name is required"),
  companyWebsite: z.string().url("Invalid URL").optional().or(z.literal("")).default(""),
  industry: z.string().optional().default(""),
  companyDescription: z.string().optional().default(""),
  productName: z.string().optional().default(""),
  productDescription: z.string().optional().default(""),
  valueProposition: z.string().optional().default(""),
  targetAudience: z.string().optional().default(""),
  painPoints: z.string().optional().default(""),
  differentiators: z.string().optional().default(""),
  socialProof: z.string().optional().default(""),
  commonObjections: z.string().optional().default(""),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

// Default empty profile
export const defaultUserProfile: UserProfile = {
  senderName: "",
  senderTitle: "",
  senderEmail: "",
  calendarLink: "",
  companyName: "",
  companyWebsite: "",
  industry: "",
  companyDescription: "",
  productName: "",
  productDescription: "",
  valueProposition: "",
  targetAudience: "",
  painPoints: "",
  differentiators: "",
  socialProof: "",
  commonObjections: "",
};

// Prospect schema for email generation
export const prospectSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  company: z.string().min(1, "Company is required"),
  title: z.string().min(1, "Title is required"),
  email: z.string().email("Invalid email"),
  linkedinUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type Prospect = z.infer<typeof prospectSchema>;

// Email generation request schema
export const generateEmailRequestSchema = z.object({
  prospect: prospectSchema,
  tone: z.enum(["casual", "professional", "hyper-personal"]).default("professional"),
  length: z.enum(["short", "medium"]).default("medium"),
});

export type GenerateEmailRequest = z.infer<typeof generateEmailRequestSchema>;

// Generated email response
export const generatedEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type GeneratedEmail = z.infer<typeof generatedEmailSchema>;

// Bulk generation request
export const bulkGenerateRequestSchema = z.object({
  prospects: z.array(prospectSchema),
  tone: z.enum(["casual", "professional", "hyper-personal"]).default("professional"),
  length: z.enum(["short", "medium"]).default("medium"),
});

export type BulkGenerateRequest = z.infer<typeof bulkGenerateRequestSchema>;

// Prospect with status for bulk operations
export type ProspectStatus = "pending" | "generating" | "ready" | "sent" | "error";

export interface ProspectWithStatus extends Prospect {
  id: string;
  status: ProspectStatus;
  generatedEmail?: GeneratedEmail;
  error?: string;
}

// CRM types
export type CrmProvider = "hubspot" | "salesforce" | "pipedrive";

export interface CrmConnection {
  id: number;
  provider: CrmProvider;
  accountName: string | null;
  isActive: boolean;
  lastSyncAt: Date | null;
}
