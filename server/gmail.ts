// Gmail API integration service
// Uses OAuth2 for authentication and Gmail API for sending emails
// Docs: https://developers.google.com/gmail/api/guides

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
}

export class GmailService {
  private accessToken: string;
  private refreshToken?: string;

  constructor(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  // Get OAuth authorization URL
  static getAuthUrl(redirectUri: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("GOOGLE_CLIENT_ID is not configured");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  static async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<GoogleTokenResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google client credentials are not configured");
    }

    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Gmail] Token exchange error:", error);
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  // Refresh access token
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google client credentials are not configured");
    }

    const params = new URLSearchParams({
      refresh_token: this.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Gmail] Token refresh error:", error);
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    return data.access_token;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
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
      console.log("[Gmail] Token expired, refreshing...");
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
        throw new Error(`Gmail API error: ${retryResponse.status} - ${error}`);
      }

      return retryResponse.json();
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("[Gmail] API Error:", response.status, error);
      throw new Error(`Gmail API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Get user info and test connection
  async testConnection(): Promise<{
    success: boolean;
    email?: string;
    name?: string;
    error?: string;
  }> {
    try {
      const userInfo = await this.request<GoogleUserInfo>(
        "https://www.googleapis.com/oauth2/v2/userinfo"
      );

      return {
        success: true,
        email: userInfo.email,
        name: userInfo.name,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to connect to Gmail",
      };
    }
  }

  // Create a raw email message in RFC 2822 format
  private createRawEmail(params: {
    to: string;
    from: string;
    subject: string;
    body: string;
    replyTo?: string;
  }): string {
    const { to, from, subject, body, replyTo } = params;

    // Build headers
    const headers = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
    ];

    if (replyTo) {
      headers.push(`Reply-To: ${replyTo}`);
    }

    // Combine headers and body
    const email = `${headers.join("\r\n")}\r\n\r\n${body}`;

    // Encode to base64url (required by Gmail API)
    const base64Email = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return base64Email;
  }

  // Send an email via Gmail API
  async sendEmail(params: {
    to: string;
    from: string;
    subject: string;
    body: string;
    replyTo?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const rawEmail = this.createRawEmail(params);

      const response = await this.request<GmailMessage>(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          body: JSON.stringify({
            raw: rawEmail,
          }),
        }
      );

      console.log("[Gmail] Email sent successfully:", response.id);

      return {
        success: true,
        messageId: response.id,
      };
    } catch (error: any) {
      console.error("[Gmail] Send email error:", error);
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

// Factory function to create Gmail service from stored tokens
export function createGmailService(
  accessToken: string,
  refreshToken?: string
): GmailService {
  return new GmailService(accessToken, refreshToken);
}

// Check if Gmail is configured
export function isGmailConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
