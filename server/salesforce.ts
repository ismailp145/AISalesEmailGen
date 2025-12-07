// Salesforce API integration service
// Uses OAuth2 authorization code flow for authentication
// Docs: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/

import type { InsertProspect } from "@shared/schema";

// Prospect data from CRM (userId is added by the caller when saving)
export type CrmProspectData = Omit<InsertProspect, 'userId'>;

interface SalesforceTokenResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

interface SalesforceContact {
  Id: string;
  Email: string;
  FirstName: string;
  LastName: string;
  Title?: string;
  Account?: {
    Name: string;
  };
  LinkedIn_Profile__c?: string;
  Description?: string;
}

interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

interface SalesforceUserInfo {
  user_id: string;
  organization_id: string;
  username: string;
  display_name: string;
}

export class SalesforceService {
  private accessToken: string;
  private instanceUrl: string;
  private refreshToken?: string;

  constructor(accessToken: string, instanceUrl: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.instanceUrl = instanceUrl;
    this.refreshToken = refreshToken;
  }

  // Get OAuth authorization URL
  static getAuthUrl(redirectUri: string): string {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    if (!clientId) {
      throw new Error("SALESFORCE_CLIENT_ID is not configured");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "api refresh_token offline_access",
    });

    return `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  static async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<SalesforceTokenResponse> {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Salesforce client credentials are not configured");
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Salesforce] Token exchange error:", error);
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  // Refresh access token
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Salesforce client credentials are not configured");
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Salesforce] Token refresh error:", error);
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    return data.access_token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.instanceUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    // Handle token expiration
    if (response.status === 401 && this.refreshToken) {
      console.log("[Salesforce] Token expired, refreshing...");
      await this.refreshAccessToken();
      
      // Retry the request with new token
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.text();
        throw new Error(`Salesforce API error: ${retryResponse.status} - ${error}`);
      }

      return retryResponse.json();
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("[Salesforce] API Error:", response.status, error);
      throw new Error(`Salesforce API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Get user info and test connection
  async testConnection(): Promise<{ success: boolean; accountName?: string; userId?: string; error?: string }> {
    try {
      const userInfo = await this.request<SalesforceUserInfo>(
        "/services/oauth2/userinfo"
      );
      
      return {
        success: true,
        accountName: userInfo.display_name || userInfo.username,
        userId: userInfo.user_id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to connect to Salesforce",
      };
    }
  }

  // Fetch contacts from Salesforce
  async getContacts(maxContacts: number = 100): Promise<CrmProspectData[]> {
    const query = `
      SELECT Id, Email, FirstName, LastName, Title, Account.Name, Description
      FROM Contact
      WHERE Email != null AND FirstName != null AND LastName != null
      ORDER BY CreatedDate DESC
      LIMIT ${maxContacts}
    `.trim().replace(/\s+/g, ' ');

    const response = await this.request<SalesforceQueryResponse<SalesforceContact>>(
      `/services/data/v59.0/query?q=${encodeURIComponent(query)}`
    );

    return response.records.map((contact) => ({
      firstName: contact.FirstName,
      lastName: contact.LastName,
      email: contact.Email,
      company: contact.Account?.Name || "Unknown Company",
      title: contact.Title || "Unknown Title",
      linkedinUrl: contact.LinkedIn_Profile__c || null,
      notes: contact.Description || null,
      crmId: contact.Id,
      crmSource: "salesforce" as const,
      crmData: contact,
    }));
  }

  // Search contacts by query
  async searchContacts(searchQuery: string): Promise<CrmProspectData[]> {
    const sosl = `
      FIND {${searchQuery}*} IN ALL FIELDS
      RETURNING Contact(Id, Email, FirstName, LastName, Title, Account.Name, Description)
      LIMIT 50
    `.trim().replace(/\s+/g, ' ');

    const response = await this.request<{ searchRecords: SalesforceContact[] }>(
      `/services/data/v59.0/search/?q=${encodeURIComponent(sosl)}`
    );

    return response.searchRecords
      .filter((c) => c.Email && c.FirstName && c.LastName)
      .map((contact) => ({
        firstName: contact.FirstName,
        lastName: contact.LastName,
        email: contact.Email,
        company: contact.Account?.Name || "Unknown Company",
        title: contact.Title || "Unknown Title",
        linkedinUrl: contact.LinkedIn_Profile__c || null,
        notes: contact.Description || null,
        crmId: contact.Id,
        crmSource: "salesforce" as const,
        crmData: contact,
      }));
  }

  // Log email activity as a Task in Salesforce
  async logEmailActivity(
    contactId: string,
    email: {
      subject: string;
      body: string;
      fromEmail: string;
      toEmail: string;
    }
  ): Promise<{ success: boolean; activityId?: string; error?: string }> {
    try {
      const task = {
        Subject: `Email: ${email.subject}`,
        Description: email.body,
        Status: "Completed",
        Priority: "Normal",
        TaskSubtype: "Email",
        WhoId: contactId,
        ActivityDate: new Date().toISOString().split("T")[0],
      };

      const response = await this.request<{ id: string; success: boolean }>(
        "/services/data/v59.0/sobjects/Task",
        {
          method: "POST",
          body: JSON.stringify(task),
        }
      );

      return {
        success: response.success,
        activityId: response.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to log activity",
      };
    }
  }
}

// Factory function to create Salesforce service from stored tokens
export function createSalesforceService(
  accessToken: string,
  instanceUrl: string,
  refreshToken?: string
): SalesforceService {
  return new SalesforceService(accessToken, instanceUrl, refreshToken);
}

// Check if Salesforce is configured
export function isSalesforceConfigured(): boolean {
  return !!(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET);
}
