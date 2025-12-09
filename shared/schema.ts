import { z } from "zod";
import { pgTable, text, serial, timestamp, jsonb, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// ============================================
// Database Tables (Drizzle ORM)
// ============================================

// User profiles table - stores sender/company info
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Clerk user ID - unique to ensure one profile per user
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
  userId: text("user_id").notNull(), // Clerk user ID
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  linkedinUrl: text("linkedin_url"),
  linkedinContent: text("linkedin_content"), // Pasted LinkedIn profile data
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
  userId: text("user_id").notNull(), // Clerk user ID
  prospectId: integer("prospect_id").references(() => prospects.id), // Nullable - emails can exist without a prospect
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  tone: text("tone").notNull(),
  length: text("length").notNull(),
  status: text("status").notNull().default("generated"), // 'generated', 'sent', 'opened', 'replied'
  emailProvider: text("email_provider"), // 'sendgrid', 'gmail', 'outlook'
  sentAt: timestamp("sent_at"),
  crmActivityId: text("crm_activity_id"), // ID of activity pushed to CRM
  crmSyncedAt: timestamp("crm_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CRM connections table - stores OAuth tokens and connection state
export const crmConnections = pgTable("crm_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Clerk user ID
  provider: text("provider").notNull(), // 'hubspot', 'salesforce', 'pipedrive', 'gmail', 'outlook'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  accountId: text("account_id"), // HubSpot portal ID, Salesforce instance URL, etc.
  accountName: text("account_name"),
  isActive: text("is_active").notNull().default("true"),
  lastSyncAt: timestamp("last_sync_at"),
  syncSettings: jsonb("sync_settings"), // What to sync, filters, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// Email Sequences Tables
// ============================================

// Sequences table - the sequence template
export const sequences = pgTable("sequences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Clerk user ID
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // 'draft', 'active', 'paused', 'archived'
  tone: text("tone").notNull().default("professional"), // 'casual', 'professional', 'hyper-personal'
  length: text("length").notNull().default("medium"), // 'short', 'medium'
  totalEnrolled: integer("total_enrolled").notNull().default(0),
  totalCompleted: integer("total_completed").notNull().default(0),
  totalReplied: integer("total_replied").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sequence steps table - individual steps in a sequence
export const sequenceSteps = pgTable("sequence_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(), // 1, 2, 3, etc.
  delayDays: integer("delay_days").notNull(), // Days after enrollment (0 = immediate, 1 = day 1, 3 = day 3)
  sendTimeHour: integer("send_time_hour").notNull().default(9), // Hour of day to send (0-23)
  sendTimeMinute: integer("send_time_minute").notNull().default(0), // Minute of hour (0-59)
  subjectTemplate: text("subject_template"), // Optional: override subject for follow-ups
  bodyTemplate: text("body_template"), // Optional: custom template, or null for AI generation
  isFollowUp: boolean("is_follow_up").notNull().default(false), // Whether this is a follow-up to previous email
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sequence enrollments table - tracks prospects in sequences
export const sequenceEnrollments = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"), // 'active', 'paused', 'completed', 'replied', 'bounced', 'unsubscribed'
  currentStepNumber: integer("current_step_number").notNull().default(0), // 0 = not started yet
  nextSendAt: timestamp("next_send_at"), // When to send the next email
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  repliedAt: timestamp("replied_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
});

// Scheduled emails table - emails queued to be sent
export const scheduledEmails = pgTable("scheduled_emails", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => sequenceEnrollments.id, { onDelete: "cascade" }),
  stepId: integer("step_id").notNull().references(() => sequenceSteps.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'sending', 'sent', 'failed', 'cancelled'
  sentAt: timestamp("sent_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const prospectsRelations = relations(prospects, ({ many }) => ({
  emailActivities: many(emailActivities),
  enrollments: many(sequenceEnrollments),
}));

export const emailActivitiesRelations = relations(emailActivities, ({ one }) => ({
  prospect: one(prospects, {
    fields: [emailActivities.prospectId],
    references: [prospects.id],
  }),
}));

export const sequencesRelations = relations(sequences, ({ many }) => ({
  steps: many(sequenceSteps),
  enrollments: many(sequenceEnrollments),
}));

export const sequenceStepsRelations = relations(sequenceSteps, ({ one, many }) => ({
  sequence: one(sequences, {
    fields: [sequenceSteps.sequenceId],
    references: [sequences.id],
  }),
  scheduledEmails: many(scheduledEmails),
}));

export const sequenceEnrollmentsRelations = relations(sequenceEnrollments, ({ one, many }) => ({
  sequence: one(sequences, {
    fields: [sequenceEnrollments.sequenceId],
    references: [sequences.id],
  }),
  prospect: one(prospects, {
    fields: [sequenceEnrollments.prospectId],
    references: [prospects.id],
  }),
  scheduledEmails: many(scheduledEmails),
}));

export const scheduledEmailsRelations = relations(scheduledEmails, ({ one }) => ({
  enrollment: one(sequenceEnrollments, {
    fields: [scheduledEmails.enrollmentId],
    references: [sequenceEnrollments.id],
  }),
  step: one(sequenceSteps, {
    fields: [scheduledEmails.stepId],
    references: [sequenceSteps.id],
  }),
  prospect: one(prospects, {
    fields: [scheduledEmails.prospectId],
    references: [prospects.id],
  }),
}));

// Insert schemas
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProspectSchema = createInsertSchema(prospects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailActivitySchema = createInsertSchema(emailActivities).omit({ id: true, createdAt: true });
export const insertCrmConnectionSchema = createInsertSchema(crmConnections).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSequenceSchema = createInsertSchema(sequences).omit({ id: true, createdAt: true, updatedAt: true, totalEnrolled: true, totalCompleted: true, totalReplied: true });
export const insertSequenceStepSchema = createInsertSchema(sequenceSteps).omit({ id: true, createdAt: true });
export const insertSequenceEnrollmentSchema = createInsertSchema(sequenceEnrollments).omit({ id: true, enrolledAt: true, lastActivityAt: true });
export const insertScheduledEmailSchema = createInsertSchema(scheduledEmails).omit({ id: true, createdAt: true });

// Types
export type UserProfileRecord = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type ProspectRecord = typeof prospects.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type EmailActivityRecord = typeof emailActivities.$inferSelect;
export type InsertEmailActivity = z.infer<typeof insertEmailActivitySchema>;
export type CrmConnectionRecord = typeof crmConnections.$inferSelect;
export type InsertCrmConnection = z.infer<typeof insertCrmConnectionSchema>;
export type SequenceRecord = typeof sequences.$inferSelect;
export type InsertSequence = z.infer<typeof insertSequenceSchema>;
export type SequenceStepRecord = typeof sequenceSteps.$inferSelect;
export type InsertSequenceStep = z.infer<typeof insertSequenceStepSchema>;
export type SequenceEnrollmentRecord = typeof sequenceEnrollments.$inferSelect;
export type InsertSequenceEnrollment = z.infer<typeof insertSequenceEnrollmentSchema>;
export type ScheduledEmailRecord = typeof scheduledEmails.$inferSelect;
export type InsertScheduledEmail = z.infer<typeof insertScheduledEmailSchema>;

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

// Detected trigger schema for API
export const detectedTriggerSchema = z.object({
  id: z.string(),
  type: z.enum(["news", "linkedin", "company_event", "industry_trend", "job_change", "funding"]),
  title: z.string(),
  description: z.string(),
  relevance: z.enum(["high", "medium", "low"]),
  source: z.string(),
  date: z.string().optional(),
  selected: z.boolean().optional(),
});

// Email generation request schema
export const generateEmailRequestSchema = z.object({
  prospect: prospectSchema,
  tone: z.enum(["casual", "professional", "hyper-personal"]).default("professional"),
  length: z.enum(["short", "medium"]).default("medium"),
  triggers: z.array(detectedTriggerSchema).optional(),
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

// ============================================
// Sequence API Schemas
// ============================================

// Sequence step schema for API
export const sequenceStepApiSchema = z.object({
  stepNumber: z.number().min(1),
  delayDays: z.number().min(0),
  sendTimeHour: z.number().min(0).max(23).default(9),
  sendTimeMinute: z.number().min(0).max(59).default(0),
  subjectTemplate: z.string().optional(),
  bodyTemplate: z.string().optional(),
  isFollowUp: z.boolean().default(false),
});

export type SequenceStepApi = z.infer<typeof sequenceStepApiSchema>;

// Create sequence request
export const createSequenceRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  tone: z.enum(["casual", "professional", "hyper-personal"]).default("professional"),
  length: z.enum(["short", "medium"]).default("medium"),
  steps: z.array(sequenceStepApiSchema).min(1, "At least one step is required"),
});

export type CreateSequenceRequest = z.infer<typeof createSequenceRequestSchema>;

// Update sequence request
export const updateSequenceRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  tone: z.enum(["casual", "professional", "hyper-personal"]).optional(),
  length: z.enum(["short", "medium"]).optional(),
  steps: z.array(sequenceStepApiSchema).optional(),
});

export type UpdateSequenceRequest = z.infer<typeof updateSequenceRequestSchema>;

// Enroll prospects request
export const enrollProspectsRequestSchema = z.object({
  prospectIds: z.array(z.number()).min(1, "At least one prospect is required"),
});

export type EnrollProspectsRequest = z.infer<typeof enrollProspectsRequestSchema>;

// Sequence status types
export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type EnrollmentStatus = "active" | "paused" | "completed" | "replied" | "bounced" | "unsubscribed";
export type ScheduledEmailStatus = "scheduled" | "sending" | "sent" | "failed" | "cancelled";

// Sequence with steps for API response
export interface SequenceWithSteps extends SequenceRecord {
  steps: SequenceStepRecord[];
}

// Enrollment with prospect info for API response
export interface EnrollmentWithProspect extends SequenceEnrollmentRecord {
  prospect: ProspectRecord;
}

// ============================================
// Trigger Detection Types
// ============================================

export type TriggerType = "news" | "linkedin" | "company_event" | "industry_trend" | "job_change" | "funding";

export interface DetectedTrigger {
  id: string;
  type: TriggerType;
  title: string;
  description: string;
  relevance: "high" | "medium" | "low";
  source: string;
  date?: string;
  selected?: boolean;
}

export const detectTriggersRequestSchema = z.object({
  prospect: prospectSchema,
});

export type DetectTriggersRequest = z.infer<typeof detectTriggersRequestSchema>;

export interface DetectTriggersResponse {
  triggers: DetectedTrigger[];
  prospectSummary: string;
}
