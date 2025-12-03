import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  userProfiles,
  prospects,
  emailActivities,
  crmConnections,
  type UserProfile,
  type Prospect,
  type ProspectWithStatus,
  type GeneratedEmail,
  type CrmProvider,
  type CrmConnection,
  type ProspectRecord,
  type InsertProspect,
  defaultUserProfile,
} from "@shared/schema";

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
  getCrmConnection(provider: CrmProvider): Promise<CrmConnection | null>;
  saveCrmConnection(provider: CrmProvider, data: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    accountId?: string;
    accountName?: string;
  }): Promise<CrmConnection>;
  disconnectCrm(provider: CrmProvider): Promise<void>;
  
  // Prospect database operations (for CRM sync)
  saveProspects(prospects: InsertProspect[]): Promise<ProspectRecord[]>;
  getProspectsByCrmSource(source: CrmProvider): Promise<ProspectRecord[]>;
  getAllProspects(): Promise<ProspectRecord[]>;
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

  async getCrmConnection(provider: CrmProvider): Promise<CrmConnection | null> {
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
    };
  }

  async saveCrmConnection(provider: CrmProvider, data: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    accountId?: string;
    accountName?: string;
  }): Promise<CrmConnection> {
    const [existing] = await db.select()
      .from(crmConnections)
      .where(eq(crmConnections.provider, provider))
      .limit(1);
    
    const connectionData = {
      provider,
      accessToken: data.accessToken || null,
      refreshToken: data.refreshToken || null,
      tokenExpiresAt: data.tokenExpiresAt || null,
      accountId: data.accountId || null,
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

  async disconnectCrm(provider: CrmProvider): Promise<void> {
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
}

export const storage = new DatabaseStorage();
