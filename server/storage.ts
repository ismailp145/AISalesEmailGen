import { randomUUID } from "crypto";
import type { Prospect, ProspectWithStatus, GeneratedEmail, UserProfile } from "@shared/schema";
import { defaultUserProfile } from "@shared/schema";

export interface IStorage {
  // User profile operations
  getUserProfile(): Promise<UserProfile>;
  saveUserProfile(profile: UserProfile): Promise<UserProfile>;
  
  // Campaign/Prospect operations
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
}

export class MemStorage implements IStorage {
  private campaigns: Map<string, ProspectWithStatus[]>;
  private userProfile: UserProfile;

  constructor() {
    this.campaigns = new Map();
    this.userProfile = { ...defaultUserProfile };
  }
  
  async getUserProfile(): Promise<UserProfile> {
    return this.userProfile;
  }
  
  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    this.userProfile = { ...profile };
    return this.userProfile;
  }

  async createCampaign(prospects: Prospect[]): Promise<ProspectWithStatus[]> {
    const campaignId = randomUUID();
    const prospectsWithStatus: ProspectWithStatus[] = prospects.map((p) => ({
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
}

export const storage = new MemStorage();
