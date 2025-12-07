// HubSpot API integration service
// Uses API key authentication - user provides their HubSpot Private App access token
// Docs: https://developers.hubspot.com/docs/api/private-apps

import type { InsertProspect, ProspectRecord } from "@shared/schema";

// Prospect data from CRM (userId is added by the caller when saving)
export type CrmProspectData = Omit<InsertProspect, 'userId'>;

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    jobtitle?: string;
    linkedinbio?: string;
    hs_linkedin_url?: string;
    notes?: string;
  };
}

interface HubSpotContactsResponse {
  results: HubSpotContact[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

interface HubSpotEngagement {
  engagement: {
    type: string;
    timestamp: number;
  };
  associations: {
    contactIds: number[];
  };
  metadata: {
    subject?: string;
    body?: string;
    from?: { email: string };
    to?: Array<{ email: string }>;
  };
}

export class HubSpotService {
  private apiKey: string;
  private baseUrl = "https://api.hubapi.com";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[HubSpot] API Error:", response.status, error);
      throw new Error(`HubSpot API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Test connection and get account info
  async testConnection(): Promise<{ success: boolean; accountName?: string; error?: string }> {
    try {
      const response = await this.request<{ portalId: number; accountType: string }>(
        "/account-info/v3/details"
      );
      return {
        success: true,
        accountName: `HubSpot Portal ${response.portalId}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to connect to HubSpot",
      };
    }
  }

  // Fetch contacts from HubSpot with pagination
  async getContacts(maxContacts: number = 100): Promise<CrmProspectData[]> {
    const properties = [
      "email",
      "firstname",
      "lastname",
      "company",
      "jobtitle",
      "hs_linkedin_url",
    ].join(",");

    const prospects: CrmProspectData[] = [];
    let after: string | undefined;
    const pageSize = Math.min(100, maxContacts); // HubSpot max is 100 per page
    
    // Paginate through results
    while (prospects.length < maxContacts) {
      const url = `/crm/v3/objects/contacts?limit=${pageSize}&properties=${properties}${after ? `&after=${after}` : ""}`;
      
      const response = await this.request<HubSpotContactsResponse>(url);

      for (const contact of response.results) {
        if (prospects.length >= maxContacts) break;
        
        const props = contact.properties;
        
        // Skip contacts without required fields
        if (!props.email || !props.firstname || !props.lastname) {
          continue;
        }

        prospects.push({
          firstName: props.firstname,
          lastName: props.lastname,
          email: props.email,
          company: props.company || "Unknown Company",
          title: props.jobtitle || "Unknown Title",
          linkedinUrl: props.hs_linkedin_url || null,
          notes: null,
          crmId: contact.id,
          crmSource: "hubspot",
          crmData: props,
        });
      }

      // Check if there are more pages
      if (response.paging?.next?.after) {
        after = response.paging.next.after;
      } else {
        break; // No more pages
      }
    }

    return prospects;
  }

  // Search contacts by criteria
  async searchContacts(query: string): Promise<CrmProspectData[]> {
    const response = await this.request<HubSpotContactsResponse>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          query,
          limit: 50,
          properties: [
            "email",
            "firstname",
            "lastname",
            "company",
            "jobtitle",
            "hs_linkedin_url",
          ],
        }),
      }
    );

    return response.results
      .filter(c => c.properties.email && c.properties.firstname && c.properties.lastname)
      .map(contact => ({
        firstName: contact.properties.firstname!,
        lastName: contact.properties.lastname!,
        email: contact.properties.email!,
        company: contact.properties.company || "Unknown Company",
        title: contact.properties.jobtitle || "Unknown Title",
        linkedinUrl: contact.properties.hs_linkedin_url || null,
        notes: null,
        crmId: contact.id,
        crmSource: "hubspot" as const,
        crmData: contact.properties,
      }));
  }

  // Log email activity to HubSpot
  async logEmailActivity(contactId: string, email: {
    subject: string;
    body: string;
    fromEmail: string;
    toEmail: string;
  }): Promise<{ success: boolean; activityId?: string; error?: string }> {
    try {
      // Create an email engagement in HubSpot
      const response = await this.request<{ id: string }>(
        "/crm/v3/objects/emails",
        {
          method: "POST",
          body: JSON.stringify({
            properties: {
              hs_timestamp: Date.now(),
              hs_email_subject: email.subject,
              hs_email_text: email.body,
              hs_email_direction: "EMAIL",
              hs_email_status: "SENT",
            },
            associations: [
              {
                to: { id: contactId },
                types: [
                  {
                    associationCategory: "HUBSPOT_DEFINED",
                    associationTypeId: 198, // Email to Contact association
                  },
                ],
              },
            ],
          }),
        }
      );

      return {
        success: true,
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

// Factory function to create HubSpot service if configured
export function createHubSpotService(): HubSpotService | null {
  const apiKey = process.env.HUBSPOT_API_KEY;
  
  if (!apiKey) {
    return null;
  }

  return new HubSpotService(apiKey);
}
