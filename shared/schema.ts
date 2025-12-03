import { z } from "zod";

// User profile schema for sender information
export const userProfileSchema = z.object({
  // Personal info
  senderName: z.string().min(1, "Name is required"),
  senderTitle: z.string().optional(),
  senderEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  calendarLink: z.string().url("Invalid URL").optional().or(z.literal("")),
  
  // Company info
  companyName: z.string().min(1, "Company name is required"),
  companyWebsite: z.string().url("Invalid URL").optional().or(z.literal("")),
  industry: z.string().optional(),
  companyDescription: z.string().optional(),
  
  // Product/Service info
  productName: z.string().optional(),
  productDescription: z.string().optional(),
  valueProposition: z.string().optional(),
  targetAudience: z.string().optional(),
  
  // Sales context
  painPoints: z.string().optional(),
  differentiators: z.string().optional(),
  socialProof: z.string().optional(),
  commonObjections: z.string().optional(),
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
