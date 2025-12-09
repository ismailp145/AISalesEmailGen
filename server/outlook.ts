// Microsoft Outlook/Graph API integration service
// Uses OAuth2 for authentication and Microsoft Graph API for sending emails
// Docs: https://docs.microsoft.com/en-us/graph/api/user-sendmail

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface MicrosoftUserInfo {
  id: string;
  mail: string;
  displayName: string;
  userPrincipalName: string;
}

interface GraphMailMessage {
  id: string;
}

export class OutlookService {
  private accessToken: string;
  private refreshToken?: string;
  private onTokenRefresh?: (newAccessToken: string) => Promise<void>;

  constructor(
    accessToken: string,
    refreshToken?: string,
    onTokenRefresh?: (newAccessToken: string) => Promise<void>
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.onTokenRefresh = onTokenRefresh;
  }

  // Get OAuth authorization URL
  static getAuthUrl(redirectUri: string): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
      throw new Error("MICROSOFT_CLIENT_ID is not configured");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: [
        "offline_access",
        "User.Read",
        "Mail.Send",
      ].join(" "),
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  static async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<MicrosoftTokenResponse> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Microsoft client credentials are not configured");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Outlook] Token exchange error:", error);
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  // Refresh access token
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Microsoft client credentials are not configured");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Outlook] Token refresh error:", error);
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;

    // Persist the new access token to the database via callback
    if (this.onTokenRefresh) {
      try {
        await this.onTokenRefresh(data.access_token);
        console.log("[Outlook] Access token persisted to database");
      } catch (err) {
        console.error("[Outlook] Failed to persist refreshed token:", err);
        // Don't throw - the token refresh itself succeeded
      }
    }

    return data.access_token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `https://graph.microsoft.com/v1.0${endpoint}`;

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
      console.log("[Outlook] Token expired, refreshing...");
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
        throw new Error(`Graph API error: ${retryResponse.status} - ${error}`);
      }

      // Some endpoints (like sendMail) return empty body on success
      const text = await retryResponse.text();
      return text ? JSON.parse(text) : ({} as T);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("[Outlook] API Error:", response.status, error);
      throw new Error(`Graph API error: ${response.status} - ${error}`);
    }

    // Some endpoints (like sendMail) return empty body on success
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  // Get user info and test connection
  async testConnection(): Promise<{
    success: boolean;
    email?: string;
    name?: string;
    error?: string;
  }> {
    try {
      const userInfo = await this.request<MicrosoftUserInfo>("/me");

      return {
        success: true,
        email: userInfo.mail || userInfo.userPrincipalName,
        name: userInfo.displayName,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to connect to Outlook",
      };
    }
  }

  // Send an email via Microsoft Graph API
  async sendEmail(params: {
    to: string;
    from?: string; // Microsoft Graph uses authenticated user's email
    subject: string;
    body: string;
    replyTo?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const message = {
        message: {
          subject: params.subject,
          body: {
            contentType: "Text",
            content: params.body,
          },
          toRecipients: [
            {
              emailAddress: {
                address: params.to,
              },
            },
          ],
          ...(params.replyTo && {
            replyTo: [
              {
                emailAddress: {
                  address: params.replyTo,
                },
              },
            ],
          }),
        },
        saveToSentItems: true,
      };

      await this.request("/me/sendMail", {
        method: "POST",
        body: JSON.stringify(message),
      });

      console.log("[Outlook] Email sent successfully");

      return {
        success: true,
      };
    } catch (error: any) {
      console.error("[Outlook] Send email error:", error);
      return {
        success: false,
        error: error.message || "Failed to send email",
      };
    }
  }

  // Get the current access token (for storing)
  getAccessToken(): string {
    return this.accessToken;
  }
}

// Factory function to create Outlook service from stored tokens
export function createOutlookService(
  accessToken: string,
  refreshToken?: string,
  onTokenRefresh?: (newAccessToken: string) => Promise<void>
): OutlookService {
  return new OutlookService(accessToken, refreshToken, onTokenRefresh);
}

// Check if Outlook is configured
export function isOutlookConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );
}
