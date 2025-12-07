import { randomUUID } from "crypto";
import { eq, desc, and, lte, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  userProfiles,
  prospects,
  emailActivities,
  crmConnections,
  sequences,
  sequenceSteps,
  sequenceEnrollments,
  scheduledEmails,
  type UserProfile,
  type Prospect,
  type ProspectWithStatus,
  type GeneratedEmail,
  type CrmProvider,
  type CrmConnection,
  type ProspectRecord,
  type InsertProspect,
  type SequenceRecord,
  type SequenceStepRecord,
  type SequenceEnrollmentRecord,
  type ScheduledEmailRecord,
  type InsertSequence,
  type InsertSequenceStep,
  type InsertSequenceEnrollment,
  type InsertScheduledEmail,
  type SequenceWithSteps,
  type EnrollmentWithProspect,
  type CreateSequenceRequest,
  type SequenceStatus,
  type EnrollmentStatus,
  type EmailActivityRecord,
  defaultUserProfile,
} from "@shared/schema";

// Extended CRM connection with full OAuth data
export interface CrmConnectionFull extends CrmConnection {
  accessToken?: string | null;
  refreshToken?: string | null;
  instanceUrl?: string | null;
}

// Email activity input for saving
export interface SaveEmailActivityInput {
  prospectEmail: string;
  prospectName: string;
  prospectCompany: string;
  subject: string;
  body: string;
  tone: string;
  length: string;
  status: string;
  emailProvider?: string;
}

export interface IStorage {
  // User profile operations
  getUserProfile(): Promise<UserProfile>;
  saveUserProfile(profile: UserProfile): Promise<UserProfile>;
  
  // Campaign/Prospect operations (in-memory for bulk campaigns)
  createCampaign(prospects: Prospect[]): Promise<ProspectWithStatus[]>;
  getCampaign(campaignId: string): Promise<ProspectWithStatus[] | undefined>;
  updateProspectStatus(
    campaignId: string,
    prospectId: string,
    status: ProspectWithStatus["status"],
    email?: GeneratedEmail,
    error?: string
  ): Promise<ProspectWithStatus | undefined>;
  getProspect(campaignId: string, prospectId: string): Promise<ProspectWithStatus | undefined>;
  
  // CRM operations
  getCrmConnections(): Promise<CrmConnection[]>;
  getCrmConnection(provider: CrmProvider | string): Promise<CrmConnectionFull | null>;
  saveCrmConnection(provider: CrmProvider | string, data: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    accountId?: string;
    accountName?: string;
    instanceUrl?: string;
  }): Promise<CrmConnection>;
  disconnectCrm(provider: CrmProvider | string): Promise<void>;
  
  // Prospect database operations (for CRM sync)
  saveProspects(prospects: InsertProspect[]): Promise<ProspectRecord[]>;
  getProspectsByCrmSource(source: CrmProvider): Promise<ProspectRecord[]>;
  getAllProspects(): Promise<ProspectRecord[]>;
  
  // Email activity operations
  saveEmailActivity(data: SaveEmailActivityInput): Promise<EmailActivityRecord>;
  getEmailActivities(limit?: number, offset?: number, status?: string): Promise<EmailActivityRecord[]>;
  getEmailActivity(id: number): Promise<EmailActivityRecord | null>;
  updateEmailActivityStatus(prospectEmail: string, subject: string, status: string, provider?: string): Promise<void>;
  updateEmailActivityStatusById(id: number, status: string): Promise<void>;
  
  // Sequence operations
  createSequence(data: CreateSequenceRequest): Promise<SequenceWithSteps>;
  getSequence(id: number): Promise<SequenceWithSteps | null>;
  getAllSequences(): Promise<SequenceRecord[]>;
  updateSequence(id: number, data: Partial<InsertSequence>): Promise<SequenceRecord | null>;
  updateSequenceStatus(id: number, status: SequenceStatus): Promise<SequenceRecord | null>;
  deleteSequence(id: number): Promise<boolean>;
  
  // Sequence step operations
  getSequenceSteps(sequenceId: number): Promise<SequenceStepRecord[]>;
  updateSequenceSteps(sequenceId: number, steps: InsertSequenceStep[]): Promise<SequenceStepRecord[]>;
  
  // Enrollment operations
  enrollProspects(sequenceId: number, prospectIds: number[]): Promise<SequenceEnrollmentRecord[]>;
  getEnrollments(sequenceId: number): Promise<EnrollmentWithProspect[]>;
  getEnrollmentsByProspect(prospectId: number): Promise<SequenceEnrollmentRecord[]>;
  updateEnrollmentStatus(enrollmentId: number, status: EnrollmentStatus): Promise<SequenceEnrollmentRecord | null>;
  markAsReplied(enrollmentId: number): Promise<void>;
  pauseEnrollment(enrollmentId: number): Promise<void>;
  resumeEnrollment(enrollmentId: number): Promise<void>;
  
  // Scheduled email operations
  getScheduledEmails(enrollmentId: number): Promise<ScheduledEmailRecord[]>;
  getDueEmails(): Promise<ScheduledEmailRecord[]>;
  createScheduledEmail(data: InsertScheduledEmail): Promise<ScheduledEmailRecord>;
  updateScheduledEmailStatus(id: number, status: string, error?: string): Promise<void>;
  cancelScheduledEmails(enrollmentId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // In-memory cache for bulk campaign operations (temporary, not persisted)
  private campaigns: Map<string, ProspectWithStatus[]> = new Map();

  // ============================================
  // User Profile Operations
  // ============================================
  
  async getUserProfile(): Promise<UserProfile> {
    const [profile] = await db.select().from(userProfiles).limit(1);
    
    if (!profile) {
      return defaultUserProfile;
    }
    
    return {
      senderName: profile.senderName,
      senderTitle: profile.senderTitle || "",
      senderEmail: profile.senderEmail || "",
      calendarLink: profile.calendarLink || "",
      companyName: profile.companyName,
      companyWebsite: profile.companyWebsite || "",
      industry: profile.industry || "",
      companyDescription: profile.companyDescription || "",
      productName: profile.productName || "",
      productDescription: profile.productDescription || "",
      valueProposition: profile.valueProposition || "",
      targetAudience: profile.targetAudience || "",
      painPoints: profile.painPoints || "",
      differentiators: profile.differentiators || "",
      socialProof: profile.socialProof || "",
      commonObjections: profile.commonObjections || "",
    };
  }
  
  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    const [existing] = await db.select().from(userProfiles).limit(1);
    
    const data = {
      senderName: profile.senderName,
      senderTitle: profile.senderTitle || null,
      senderEmail: profile.senderEmail || null,
      calendarLink: profile.calendarLink || null,
      companyName: profile.companyName,
      companyWebsite: profile.companyWebsite || null,
      industry: profile.industry || null,
      companyDescription: profile.companyDescription || null,
      productName: profile.productName || null,
      productDescription: profile.productDescription || null,
      valueProposition: profile.valueProposition || null,
      targetAudience: profile.targetAudience || null,
      painPoints: profile.painPoints || null,
      differentiators: profile.differentiators || null,
      socialProof: profile.socialProof || null,
      commonObjections: profile.commonObjections || null,
      updatedAt: new Date(),
    };
    
    if (existing) {
      await db.update(userProfiles).set(data).where(eq(userProfiles.id, existing.id));
    } else {
      await db.insert(userProfiles).values(data);
    }
    
    return profile;
  }

  // ============================================
  // Campaign Operations (in-memory for bulk)
  // ============================================

  async createCampaign(prospectsData: Prospect[]): Promise<ProspectWithStatus[]> {
    const campaignId = randomUUID();
    const prospectsWithStatus: ProspectWithStatus[] = prospectsData.map((p) => ({
      ...p,
      id: randomUUID(),
      status: "pending" as const,
    }));
    this.campaigns.set(campaignId, prospectsWithStatus);
    return prospectsWithStatus;
  }

  async getCampaign(campaignId: string): Promise<ProspectWithStatus[] | undefined> {
    return this.campaigns.get(campaignId);
  }

  async updateProspectStatus(
    campaignId: string,
    prospectId: string,
    status: ProspectWithStatus["status"],
    email?: GeneratedEmail,
    error?: string
  ): Promise<ProspectWithStatus | undefined> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return undefined;

    const prospectIndex = campaign.findIndex((p) => p.id === prospectId);
    if (prospectIndex === -1) return undefined;

    campaign[prospectIndex] = {
      ...campaign[prospectIndex],
      status,
      ...(email && { generatedEmail: email }),
      ...(error && { error }),
    };

    return campaign[prospectIndex];
  }

  async getProspect(
    campaignId: string,
    prospectId: string
  ): Promise<ProspectWithStatus | undefined> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return undefined;
    return campaign.find((p) => p.id === prospectId);
  }

  // ============================================
  // CRM Operations
  // ============================================

  async getCrmConnections(): Promise<CrmConnection[]> {
    const connections = await db.select().from(crmConnections).where(eq(crmConnections.isActive, "true"));
    
    return connections.map(c => ({
      id: c.id,
      provider: c.provider as CrmProvider,
      accountName: c.accountName,
      isActive: c.isActive === "true",
      lastSyncAt: c.lastSyncAt,
    }));
  }

  async getCrmConnection(provider: CrmProvider | string): Promise<CrmConnectionFull | null> {
    const [connection] = await db.select()
      .from(crmConnections)
      .where(eq(crmConnections.provider, provider))
      .limit(1);
    
    if (!connection) return null;
    
    return {
      id: connection.id,
      provider: connection.provider as CrmProvider,
      accountName: connection.accountName,
      isActive: connection.isActive === "true",
      lastSyncAt: connection.lastSyncAt,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      instanceUrl: connection.accountId, // Using accountId to store instance URL for Salesforce
    };
  }

  async saveCrmConnection(provider: CrmProvider | string, data: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    accountId?: string;
    accountName?: string;
    instanceUrl?: string;
  }): Promise<CrmConnection> {
    const [existing] = await db.select()
      .from(crmConnections)
      .where(eq(crmConnections.provider, provider))
      .limit(1);
    
    // For Salesforce, store instanceUrl in accountId field
    const accountIdValue = data.instanceUrl || data.accountId || null;
    
    const connectionData = {
      provider,
      accessToken: data.accessToken || null,
      refreshToken: data.refreshToken || null,
      tokenExpiresAt: data.tokenExpiresAt || null,
      accountId: accountIdValue,
      accountName: data.accountName || null,
      isActive: "true",
      updatedAt: new Date(),
    };
    
    let connection;
    if (existing) {
      [connection] = await db.update(crmConnections)
        .set(connectionData)
        .where(eq(crmConnections.id, existing.id))
        .returning();
    } else {
      [connection] = await db.insert(crmConnections)
        .values(connectionData)
        .returning();
    }
    
    return {
      id: connection.id,
      provider: connection.provider as CrmProvider,
      accountName: connection.accountName,
      isActive: connection.isActive === "true",
      lastSyncAt: connection.lastSyncAt,
    };
  }

  async disconnectCrm(provider: CrmProvider | string): Promise<void> {
    await db.update(crmConnections)
      .set({ isActive: "false", updatedAt: new Date() })
      .where(eq(crmConnections.provider, provider));
  }

  // ============================================
  // Prospect Database Operations
  // ============================================

  async saveProspects(prospectsData: InsertProspect[]): Promise<ProspectRecord[]> {
    if (prospectsData.length === 0) return [];
    
    const saved = await db.insert(prospects)
      .values(prospectsData)
      .returning();
    
    return saved;
  }

  async getProspectsByCrmSource(source: CrmProvider): Promise<ProspectRecord[]> {
    return db.select()
      .from(prospects)
      .where(eq(prospects.crmSource, source))
      .orderBy(desc(prospects.createdAt));
  }

  async getAllProspects(): Promise<ProspectRecord[]> {
    return db.select()
      .from(prospects)
      .orderBy(desc(prospects.createdAt));
  }

  // ============================================
  // Email Activity Operations
  // ============================================

  async saveEmailActivity(data: SaveEmailActivityInput): Promise<EmailActivityRecord> {
    // First, try to find a matching prospect by email
    const [prospect] = await db.select()
      .from(prospects)
      .where(eq(prospects.email, data.prospectEmail))
      .limit(1);
    
    const [activity] = await db.insert(emailActivities)
      .values({
        prospectId: prospect?.id ?? null, // Null if no matching prospect found
        subject: data.subject,
        body: data.body,
        tone: data.tone,
        length: data.length,
        status: data.status,
      })
      .returning();
    
    return activity;
  }

  async getEmailActivities(limit: number = 50, offset: number = 0, status?: string): Promise<EmailActivityRecord[]> {
    if (status) {
      return db.select()
        .from(emailActivities)
        .where(eq(emailActivities.status, status))
        .orderBy(desc(emailActivities.createdAt))
        .limit(limit)
        .offset(offset);
    }
    
    return db.select()
      .from(emailActivities)
      .orderBy(desc(emailActivities.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getEmailActivity(id: number): Promise<EmailActivityRecord | null> {
    const [activity] = await db.select()
      .from(emailActivities)
      .where(eq(emailActivities.id, id))
      .limit(1);
    
    return activity || null;
  }

  async updateEmailActivityStatus(prospectEmail: string, subject: string, status: string, provider?: string): Promise<void> {
    // Find the most recent email activity with matching subject
    const [activity] = await db.select()
      .from(emailActivities)
      .where(eq(emailActivities.subject, subject))
      .orderBy(desc(emailActivities.createdAt))
      .limit(1);
    
    if (activity) {
      await db.update(emailActivities)
        .set({ 
          status, 
          sentAt: status === "sent" ? new Date() : undefined,
        })
        .where(eq(emailActivities.id, activity.id));
    }
  }

  async updateEmailActivityStatusById(id: number, status: string): Promise<void> {
    await db.update(emailActivities)
      .set({ 
        status, 
        sentAt: status === "sent" ? new Date() : undefined,
      })
      .where(eq(emailActivities.id, id));
  }

  // ============================================
  // Sequence Operations
  // ============================================

  async createSequence(data: CreateSequenceRequest): Promise<SequenceWithSteps> {
    const [sequence] = await db.insert(sequences)
      .values({
        name: data.name,
        description: data.description || null,
        tone: data.tone,
        length: data.length,
        status: "draft",
      })
      .returning();

    const stepsData = data.steps.map(step => ({
      sequenceId: sequence.id,
      stepNumber: step.stepNumber,
      delayDays: step.delayDays,
      sendTimeHour: step.sendTimeHour ?? 9,
      sendTimeMinute: step.sendTimeMinute ?? 0,
      subjectTemplate: step.subjectTemplate || null,
      bodyTemplate: step.bodyTemplate || null,
      isFollowUp: step.isFollowUp ?? false,
    }));

    const steps = await db.insert(sequenceSteps)
      .values(stepsData)
      .returning();

    return { ...sequence, steps };
  }

  async getSequence(id: number): Promise<SequenceWithSteps | null> {
    const [sequence] = await db.select()
      .from(sequences)
      .where(eq(sequences.id, id))
      .limit(1);

    if (!sequence) return null;

    const steps = await db.select()
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, id))
      .orderBy(sequenceSteps.stepNumber);

    return { ...sequence, steps };
  }

  async getAllSequences(): Promise<SequenceRecord[]> {
    return db.select()
      .from(sequences)
      .orderBy(desc(sequences.createdAt));
  }

  async updateSequence(id: number, data: Partial<InsertSequence>): Promise<SequenceRecord | null> {
    const [updated] = await db.update(sequences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sequences.id, id))
      .returning();
    
    return updated || null;
  }

  async updateSequenceStatus(id: number, status: SequenceStatus): Promise<SequenceRecord | null> {
    const [updated] = await db.update(sequences)
      .set({ status, updatedAt: new Date() })
      .where(eq(sequences.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteSequence(id: number): Promise<boolean> {
    const result = await db.delete(sequences)
      .where(eq(sequences.id, id))
      .returning();
    
    return result.length > 0;
  }

  // ============================================
  // Sequence Step Operations
  // ============================================

  async getSequenceSteps(sequenceId: number): Promise<SequenceStepRecord[]> {
    return db.select()
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, sequenceId))
      .orderBy(sequenceSteps.stepNumber);
  }

  async updateSequenceSteps(sequenceId: number, steps: InsertSequenceStep[]): Promise<SequenceStepRecord[]> {
    await db.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, sequenceId));
    
    if (steps.length === 0) return [];
    
    const stepsData = steps.map(step => ({
      ...step,
      sequenceId,
    }));
    
    return db.insert(sequenceSteps)
      .values(stepsData)
      .returning();
  }

  // ============================================
  // Enrollment Operations
  // ============================================

  async enrollProspects(sequenceId: number, prospectIds: number[]): Promise<SequenceEnrollmentRecord[]> {
    const enrollments = prospectIds.map(prospectId => ({
      sequenceId,
      prospectId,
      status: "active" as const,
      currentStepNumber: 0,
      nextSendAt: null,
    }));

    const inserted = await db.insert(sequenceEnrollments)
      .values(enrollments)
      .returning();

    await db.update(sequences)
      .set({ 
        totalEnrolled: db.select().from(sequenceEnrollments)
          .where(eq(sequenceEnrollments.sequenceId, sequenceId))
          .$dynamic() as any
      })
      .where(eq(sequences.id, sequenceId));

    return inserted;
  }

  async getEnrollments(sequenceId: number): Promise<EnrollmentWithProspect[]> {
    const enrollmentsList = await db.select()
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.sequenceId, sequenceId))
      .orderBy(desc(sequenceEnrollments.enrolledAt));

    const result: EnrollmentWithProspect[] = [];
    
    for (const enrollment of enrollmentsList) {
      const [prospect] = await db.select()
        .from(prospects)
        .where(eq(prospects.id, enrollment.prospectId))
        .limit(1);
      
      if (prospect) {
        result.push({ ...enrollment, prospect });
      }
    }

    return result;
  }

  async getEnrollmentsByProspect(prospectId: number): Promise<SequenceEnrollmentRecord[]> {
    return db.select()
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.prospectId, prospectId))
      .orderBy(desc(sequenceEnrollments.enrolledAt));
  }

  async updateEnrollmentStatus(enrollmentId: number, status: EnrollmentStatus): Promise<SequenceEnrollmentRecord | null> {
    const updateData: any = { status, lastActivityAt: new Date() };
    
    if (status === "completed") {
      updateData.completedAt = new Date();
    } else if (status === "replied") {
      updateData.repliedAt = new Date();
    }

    const [updated] = await db.update(sequenceEnrollments)
      .set(updateData)
      .where(eq(sequenceEnrollments.id, enrollmentId))
      .returning();
    
    return updated || null;
  }

  async markAsReplied(enrollmentId: number): Promise<void> {
    await this.updateEnrollmentStatus(enrollmentId, "replied");
    
    await db.update(scheduledEmails)
      .set({ status: "cancelled" })
      .where(and(
        eq(scheduledEmails.enrollmentId, enrollmentId),
        eq(scheduledEmails.status, "scheduled")
      ));
  }

  async pauseEnrollment(enrollmentId: number): Promise<void> {
    await this.updateEnrollmentStatus(enrollmentId, "paused");
  }

  async resumeEnrollment(enrollmentId: number): Promise<void> {
    await this.updateEnrollmentStatus(enrollmentId, "active");
  }

  // ============================================
  // Scheduled Email Operations
  // ============================================

  async getScheduledEmails(enrollmentId: number): Promise<ScheduledEmailRecord[]> {
    return db.select()
      .from(scheduledEmails)
      .where(eq(scheduledEmails.enrollmentId, enrollmentId))
      .orderBy(scheduledEmails.scheduledFor);
  }

  async getDueEmails(): Promise<ScheduledEmailRecord[]> {
    const now = new Date();
    return db.select()
      .from(scheduledEmails)
      .where(and(
        eq(scheduledEmails.status, "scheduled"),
        lte(scheduledEmails.scheduledFor, now)
      ))
      .orderBy(scheduledEmails.scheduledFor);
  }

  async createScheduledEmail(data: InsertScheduledEmail): Promise<ScheduledEmailRecord> {
    const [email] = await db.insert(scheduledEmails)
      .values(data)
      .returning();
    
    return email;
  }

  async updateScheduledEmailStatus(id: number, status: string, error?: string): Promise<void> {
    const updateData: any = { status };
    
    if (status === "sent") {
      updateData.sentAt = new Date();
    }
    if (error) {
      updateData.error = error;
    }

    await db.update(scheduledEmails)
      .set(updateData)
      .where(eq(scheduledEmails.id, id));
  }

  async cancelScheduledEmails(enrollmentId: number): Promise<void> {
    await db.update(scheduledEmails)
      .set({ status: "cancelled" })
      .where(and(
        eq(scheduledEmails.enrollmentId, enrollmentId),
        eq(scheduledEmails.status, "scheduled")
      ));
  }
}

export const storage = new DatabaseStorage();
