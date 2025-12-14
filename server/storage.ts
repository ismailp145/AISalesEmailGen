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
  SUBSCRIPTION_LIMITS,
  type UserProfile,
  type UserSubscription,
  type SubscriptionTier,
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
  defaultUserSubscription,
} from "@shared/schema";

// Extended CRM connection with full OAuth data
export interface CrmConnectionFull extends CrmConnection {
  accessToken?: string | null;
  refreshToken?: string | null;
  instanceUrl?: string | null;
}

// Email activity input for saving
export interface SaveEmailActivityInput {
  userId: string;
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
  getUserProfile(userId: string): Promise<UserProfile>;
  saveUserProfile(userId: string, profile: UserProfile): Promise<UserProfile>;
  
  // Subscription operations
  getSubscriptionInfo(userId: string): Promise<UserSubscription>;
  incrementEmailUsage(userId: string): Promise<void>;
  checkEmailLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number; tier: SubscriptionTier }>;
  resetMonthlyUsage(userId: string): Promise<void>;
  updateSubscriptionTier(userId: string, tier: SubscriptionTier, stripeData?: { customerId?: string; subscriptionId?: string; startsAt?: Date; endsAt?: Date }): Promise<void>;
  
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
  getCrmConnections(userId: string): Promise<CrmConnection[]>;
  getCrmConnection(userId: string, provider: CrmProvider | string): Promise<CrmConnectionFull | null>;
  saveCrmConnection(userId: string, provider: CrmProvider | string, data: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    accountId?: string;
    accountName?: string;
    instanceUrl?: string;
  }): Promise<CrmConnection>;
  disconnectCrm(userId: string, provider: CrmProvider | string): Promise<void>;
  
  // Prospect database operations (for CRM sync)
  saveProspects(prospects: InsertProspect[]): Promise<ProspectRecord[]>;
  getProspectsByCrmSource(source: CrmProvider): Promise<ProspectRecord[]>;
  getAllProspects(): Promise<ProspectRecord[]>;
  getProspectById(id: number): Promise<ProspectRecord | null>;
  
  // Email activity operations
  saveEmailActivity(data: SaveEmailActivityInput): Promise<EmailActivityRecord>;
  getEmailActivities(userId: string, limit?: number, offset?: number, status?: string): Promise<EmailActivityRecord[]>;
  getEmailActivity(userId: string, id: number): Promise<EmailActivityRecord | null>;
  updateEmailActivityStatus(userId: string, prospectEmail: string, subject: string, status: string, provider?: string): Promise<void>;
  updateEmailActivityStatusById(userId: string, id: number, status: string): Promise<void>;
  
  // Sequence operations
  createSequence(userId: string, data: CreateSequenceRequest): Promise<SequenceWithSteps>;
  getSequence(userId: string, id: number): Promise<SequenceWithSteps | null>;
  getSequenceById(id: number): Promise<SequenceWithSteps | null>; // Internal use only (no userId check)
  getAllSequences(userId: string): Promise<SequenceRecord[]>;
  updateSequence(userId: string, id: number, data: Partial<InsertSequence>): Promise<SequenceRecord | null>;
  updateSequenceStatus(userId: string, id: number, status: SequenceStatus): Promise<SequenceRecord | null>;
  deleteSequence(userId: string, id: number): Promise<boolean>;
  
  // Sequence step operations
  getSequenceSteps(sequenceId: number): Promise<SequenceStepRecord[]>;
  updateSequenceSteps(sequenceId: number, steps: InsertSequenceStep[]): Promise<SequenceStepRecord[]>;
  
  // Enrollment operations
  enrollProspects(sequenceId: number, prospectIds: number[]): Promise<SequenceEnrollmentRecord[]>;
  getEnrollments(sequenceId: number): Promise<EnrollmentWithProspect[]>;
  getEnrollmentById(id: number): Promise<SequenceEnrollmentRecord | null>;
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
  
  async getUserProfile(userId: string): Promise<UserProfile> {
    const [profile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
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
  
  async saveUserProfile(userId: string, profile: UserProfile): Promise<UserProfile> {
    const [existing] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    const data = {
      userId,
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
      await db.update(userProfiles)
        .set(data)
        .where(eq(userProfiles.id, existing.id));
    } else {
      await db.insert(userProfiles).values(data);
    }
    
    return profile;
  }

  // ============================================
  // Subscription Operations
  // ============================================

  async getSubscriptionInfo(userId: string): Promise<UserSubscription> {
    const [profile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    if (!profile) {
      return defaultUserSubscription;
    }
    
    return {
      subscriptionTier: profile.subscriptionTier as SubscriptionTier,
      emailsUsedThisMonth: profile.emailsUsedThisMonth,
      emailsUsedThisMonthResetAt: profile.emailsUsedThisMonthResetAt,
      subscriptionStartsAt: profile.subscriptionStartsAt,
      subscriptionEndsAt: profile.subscriptionEndsAt,
      stripeCustomerId: profile.stripeCustomerId,
      stripeSubscriptionId: profile.stripeSubscriptionId,
    };
  }

  async incrementEmailUsage(userId: string): Promise<void> {
    const [profile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    if (!profile) {
      // Create a new profile with initial email usage
      await db.insert(userProfiles).values({
        userId,
        senderName: "",
        companyName: "",
        emailsUsedThisMonth: 1,
        emailsUsedThisMonthResetAt: new Date(),
      });
      return;
    }
    
    // Check if we need to reset the monthly counter
    const now = new Date();
    const resetAt = profile.emailsUsedThisMonthResetAt;
    const shouldReset = resetAt && (
      now.getMonth() !== resetAt.getMonth() || 
      now.getFullYear() !== resetAt.getFullYear()
    );
    
    if (shouldReset) {
      await db.update(userProfiles)
        .set({ 
          emailsUsedThisMonth: 1,
          emailsUsedThisMonthResetAt: now,
          updatedAt: now,
        })
        .where(eq(userProfiles.id, profile.id));
    } else {
      await db.update(userProfiles)
        .set({ 
          emailsUsedThisMonth: profile.emailsUsedThisMonth + 1,
          updatedAt: now,
        })
        .where(eq(userProfiles.id, profile.id));
    }
  }

  async checkEmailLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number; tier: SubscriptionTier }> {
    const subscription = await this.getSubscriptionInfo(userId);
    const tier = subscription.subscriptionTier as SubscriptionTier;
    const limits = SUBSCRIPTION_LIMITS[tier];
    
    // Check if we need to reset the monthly counter
    const now = new Date();
    const resetAt = subscription.emailsUsedThisMonthResetAt;
    const shouldReset = resetAt && (
      now.getMonth() !== resetAt.getMonth() || 
      now.getFullYear() !== resetAt.getFullYear()
    );
    
    const used = shouldReset ? 0 : subscription.emailsUsedThisMonth;
    const limit = limits.emailsPerMonth;
    const allowed = used < limit;
    
    return { allowed, used, limit, tier };
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    await db.update(userProfiles)
      .set({ 
        emailsUsedThisMonth: 0,
        emailsUsedThisMonthResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId));
  }

  async updateSubscriptionTier(
    userId: string, 
    tier: SubscriptionTier, 
    stripeData?: { customerId?: string; subscriptionId?: string; startsAt?: Date; endsAt?: Date }
  ): Promise<void> {
    const [existing] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    const updateData: Record<string, unknown> = {
      subscriptionTier: tier,
      updatedAt: new Date(),
    };
    
    if (stripeData?.customerId) {
      updateData.stripeCustomerId = stripeData.customerId;
    }
    if (stripeData?.subscriptionId) {
      updateData.stripeSubscriptionId = stripeData.subscriptionId;
    }
    if (stripeData?.startsAt) {
      updateData.subscriptionStartsAt = stripeData.startsAt;
    }
    if (stripeData?.endsAt) {
      updateData.subscriptionEndsAt = stripeData.endsAt;
    }
    
    if (existing) {
      await db.update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.id, existing.id));
    } else {
      await db.insert(userProfiles).values({
        userId,
        senderName: "",
        companyName: "",
        subscriptionTier: tier,
        ...stripeData?.customerId && { stripeCustomerId: stripeData.customerId },
        ...stripeData?.subscriptionId && { stripeSubscriptionId: stripeData.subscriptionId },
        ...stripeData?.startsAt && { subscriptionStartsAt: stripeData.startsAt },
        ...stripeData?.endsAt && { subscriptionEndsAt: stripeData.endsAt },
      });
    }
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

  async getCrmConnections(userId: string): Promise<CrmConnection[]> {
    const connections = await db.select()
      .from(crmConnections)
      .where(and(
        eq(crmConnections.userId, userId),
        eq(crmConnections.isActive, "true")
      ));
    
    return connections.map(c => ({
      id: c.id,
      provider: c.provider as CrmProvider,
      accountName: c.accountName,
      isActive: c.isActive === "true",
      lastSyncAt: c.lastSyncAt,
    }));
  }

  async getCrmConnection(userId: string, provider: CrmProvider | string): Promise<CrmConnectionFull | null> {
    const [connection] = await db.select()
      .from(crmConnections)
      .where(and(
        eq(crmConnections.userId, userId),
        eq(crmConnections.provider, provider)
      ))
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

  async saveCrmConnection(userId: string, provider: CrmProvider | string, data: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    accountId?: string;
    accountName?: string;
    instanceUrl?: string;
  }): Promise<CrmConnection> {
    const [existing] = await db.select()
      .from(crmConnections)
      .where(and(
        eq(crmConnections.userId, userId),
        eq(crmConnections.provider, provider)
      ))
      .limit(1);
    
    // For Salesforce, store instanceUrl in accountId field
    const accountIdValue = data.instanceUrl || data.accountId || null;
    
    const connectionData = {
      userId,
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

  async disconnectCrm(userId: string, provider: CrmProvider | string): Promise<void> {
    await db.update(crmConnections)
      .set({ isActive: "false", updatedAt: new Date() })
      .where(and(
        eq(crmConnections.userId, userId),
        eq(crmConnections.provider, provider)
      ));
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

  async getProspectById(id: number): Promise<ProspectRecord | null> {
    const [result] = await db.select()
      .from(prospects)
      .where(eq(prospects.id, id))
      .limit(1);
    
    return result || null;
  }

  // ============================================
  // Email Activity Operations
  // ============================================

  async saveEmailActivity(data: SaveEmailActivityInput): Promise<EmailActivityRecord> {
    // First, try to find a matching prospect by email for this user
    const [prospect] = await db.select()
      .from(prospects)
      .where(and(
        eq(prospects.userId, data.userId),
        eq(prospects.email, data.prospectEmail)
      ))
      .limit(1);
    
    const [activity] = await db.insert(emailActivities)
      .values({
        userId: data.userId,
        prospectId: prospect?.id ?? null, // Null if no matching prospect found
        subject: data.subject,
        body: data.body,
        tone: data.tone,
        length: data.length,
        status: data.status,
        emailProvider: data.emailProvider || null,
      })
      .returning();
    
    return activity;
  }

  async getEmailActivities(userId: string, limit: number = 50, offset: number = 0, status?: string): Promise<EmailActivityRecord[]> {
    if (status) {
      return db.select()
        .from(emailActivities)
        .where(and(
          eq(emailActivities.userId, userId),
          eq(emailActivities.status, status)
        ))
        .orderBy(desc(emailActivities.createdAt))
        .limit(limit)
        .offset(offset);
    }
    
    return db.select()
      .from(emailActivities)
      .where(eq(emailActivities.userId, userId))
      .orderBy(desc(emailActivities.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getEmailActivity(userId: string, id: number): Promise<EmailActivityRecord | null> {
    const [activity] = await db.select()
      .from(emailActivities)
      .where(and(
        eq(emailActivities.userId, userId),
        eq(emailActivities.id, id)
      ))
      .limit(1);
    
    return activity || null;
  }

  async updateEmailActivityStatus(userId: string, prospectEmail: string, subject: string, status: string, provider?: string): Promise<void> {
    // Find the most recent email activity matching userId, subject, and prospect email
    // Join with prospects to match by email address
    const activitiesWithProspect = await db.select({
      activity: emailActivities
    })
      .from(emailActivities)
      .leftJoin(prospects, eq(emailActivities.prospectId, prospects.id))
      .where(and(
        eq(emailActivities.userId, userId),
        eq(emailActivities.subject, subject),
        // Match either via prospect email or if no prospect, any matching subject
        prospects.email ? eq(prospects.email, prospectEmail) : undefined
      ))
      .orderBy(desc(emailActivities.createdAt))
      .limit(1);
    
    // If no match with prospect, try matching just by userId and subject (for emails without linked prospect)
    let activityId: number | null = activitiesWithProspect[0]?.activity.id ?? null;
    
    if (!activityId) {
      const [fallbackActivity] = await db.select()
        .from(emailActivities)
        .where(and(
          eq(emailActivities.userId, userId),
          eq(emailActivities.subject, subject)
        ))
        .orderBy(desc(emailActivities.createdAt))
        .limit(1);
      
      activityId = fallbackActivity?.id ?? null;
    }
    
    if (activityId) {
      await db.update(emailActivities)
        .set({ 
          status, 
          sentAt: status === "sent" ? new Date() : undefined,
          emailProvider: provider || undefined,
        })
        .where(eq(emailActivities.id, activityId));
    }
  }

  async updateEmailActivityStatusById(userId: string, id: number, status: string): Promise<void> {
    // Only update if the activity belongs to the user
    await db.update(emailActivities)
      .set({ 
        status, 
        sentAt: status === "sent" ? new Date() : undefined,
      })
      .where(and(
        eq(emailActivities.userId, userId),
        eq(emailActivities.id, id)
      ));
  }

  // ============================================
  // Sequence Operations
  // ============================================

  async createSequence(userId: string, data: CreateSequenceRequest): Promise<SequenceWithSteps> {
    const [sequence] = await db.insert(sequences)
      .values({
        userId,
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

  async getSequence(userId: string, id: number): Promise<SequenceWithSteps | null> {
    const [sequence] = await db.select()
      .from(sequences)
      .where(and(
        eq(sequences.userId, userId),
        eq(sequences.id, id)
      ))
      .limit(1);

    if (!sequence) return null;

    const steps = await db.select()
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, id))
      .orderBy(sequenceSteps.stepNumber);

    return { ...sequence, steps };
  }

  // Internal method - no userId check (for background processing like scheduler)
  async getSequenceById(id: number): Promise<SequenceWithSteps | null> {
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

  async getAllSequences(userId: string): Promise<SequenceRecord[]> {
    return db.select()
      .from(sequences)
      .where(eq(sequences.userId, userId))
      .orderBy(desc(sequences.createdAt));
  }

  async updateSequence(userId: string, id: number, data: Partial<InsertSequence>): Promise<SequenceRecord | null> {
    const [updated] = await db.update(sequences)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(sequences.userId, userId),
        eq(sequences.id, id)
      ))
      .returning();
    
    return updated || null;
  }

  async updateSequenceStatus(userId: string, id: number, status: SequenceStatus): Promise<SequenceRecord | null> {
    const [updated] = await db.update(sequences)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(sequences.userId, userId),
        eq(sequences.id, id)
      ))
      .returning();
    
    return updated || null;
  }

  async deleteSequence(userId: string, id: number): Promise<boolean> {
    const result = await db.delete(sequences)
      .where(and(
        eq(sequences.userId, userId),
        eq(sequences.id, id)
      ))
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

  async getEnrollmentById(id: number): Promise<SequenceEnrollmentRecord | null> {
    const [result] = await db.select()
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.id, id))
      .limit(1);
    
    return result || null;
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
