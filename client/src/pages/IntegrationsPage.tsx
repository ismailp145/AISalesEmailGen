import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Link2, Unlink, RefreshCw, Check, AlertCircle, ExternalLink, RotateCcw, Mail } from "lucide-react";
import { SiHubspot, SiSalesforce, SiGmail } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CrmConnection {
  id: number;
  provider: string;
  accountName: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
}

interface CrmConnectionsResponse {
  connections: CrmConnection[];
  available: {
    hubspot: boolean;
    salesforce: boolean;
    gmail: boolean;
    outlook: boolean;
  };
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [location] = useLocation();

  // Handle OAuth success/error from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");

    if (success) {
      toast({
        title: `${success.charAt(0).toUpperCase() + success.slice(1)} connected`,
        description: `Your ${success} account is now linked.`,
      });
      // Clean URL
      window.history.replaceState({}, "", "/integrations");
      queryClient.invalidateQueries({ queryKey: ["/api/crm/connections"] });
    }

    if (error) {
      toast({
        title: "Connection failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/integrations");
    }
  }, [location]);

  const { data, isLoading, refetch } = useQuery<CrmConnectionsResponse>({
    queryKey: ["/api/crm/connections"],
  });

  // HubSpot mutations
  const connectHubSpotMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/crm/hubspot/connect");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to connect");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/connections"] });
      toast({
        title: "HubSpot connected",
        description: "Your HubSpot account is now linked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to HubSpot.",
        variant: "destructive",
      });
    },
  });

  const disconnectHubSpotMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/crm/hubspot/disconnect");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/connections"] });
      toast({
        title: "HubSpot disconnected",
        description: "Your HubSpot account has been unlinked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error.message || "Could not disconnect HubSpot.",
        variant: "destructive",
      });
    },
  });

  const syncHubSpotMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/crm/hubspot/sync?limit=100");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      toast({
        title: "Sync complete",
        description: `Imported ${data.synced} contacts from HubSpot.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Could not sync contacts.",
        variant: "destructive",
      });
    },
  });

  // Salesforce mutations
  const connectSalesforceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/crm/salesforce/auth");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initiate auth");
      }
      const data = await response.json();
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to Salesforce.",
        variant: "destructive",
      });
    },
  });

  const disconnectSalesforceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/crm/salesforce/disconnect");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/connections"] });
      toast({
        title: "Salesforce disconnected",
        description: "Your Salesforce account has been unlinked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error.message || "Could not disconnect Salesforce.",
        variant: "destructive",
      });
    },
  });

  // Gmail mutations
  const connectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/email/gmail/auth");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initiate auth");
      }
      const data = await response.json();
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to Gmail.",
        variant: "destructive",
      });
    },
  });

  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/email/gmail/disconnect");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/connections"] });
      toast({
        title: "Gmail disconnected",
        description: "Your Gmail account has been unlinked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error.message || "Could not disconnect Gmail.",
        variant: "destructive",
      });
    },
  });

  // Outlook mutations
  const connectOutlookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/email/outlook/auth");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initiate auth");
      }
      const data = await response.json();
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to Outlook.",
        variant: "destructive",
      });
    },
  });

  const disconnectOutlookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/email/outlook/disconnect");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/connections"] });
      toast({
        title: "Outlook disconnected",
        description: "Your Outlook account has been unlinked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error.message || "Could not disconnect Outlook.",
        variant: "destructive",
      });
    },
  });

  const hubspotConnection = data?.connections.find(c => c.provider === "hubspot");
  const salesforceConnection = data?.connections.find(c => c.provider === "salesforce");
  const gmailConnection = data?.connections.find(c => c.provider === "gmail");
  const outlookConnection = data?.connections.find(c => c.provider === "outlook");

  const isHubSpotAvailable = data?.available.hubspot;
  const isSalesforceAvailable = data?.available.salesforce;
  const isGmailAvailable = data?.available.gmail;
  const isOutlookAvailable = data?.available.outlook;

  const isHubSpotConnected = hubspotConnection?.isActive;
  const isSalesforceConnected = salesforceConnection?.isActive;
  const isGmailConnected = gmailConnection?.isActive;
  const isOutlookConnected = outlookConnection?.isActive;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your CRM and email accounts to sync contacts and send emails
        </p>
      </div>

      {/* CRM Integrations */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">CRM Integrations</h2>
        
        {/* HubSpot Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#ff7a59]/10 flex items-center justify-center">
                  <SiHubspot className="w-5 h-5 text-[#ff7a59]" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">HubSpot</CardTitle>
                  <CardDescription className="text-xs">
                    Sync contacts and log email activities
                  </CardDescription>
                </div>
              </div>
              {isHubSpotConnected && (
                <Badge variant="outline" className="text-green-500 border-green-500/30">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isHubSpotAvailable ? (
              <div className="rounded-lg bg-muted/50 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Setup Required</p>
                    <p className="text-xs text-muted-foreground">
                      Add <code className="px-1 py-0.5 bg-background rounded text-primary">HUBSPOT_API_KEY</code> to connect.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RotateCcw className="w-3 h-3 mr-2" />
                  I Added the Secret
                </Button>
              </div>
            ) : isHubSpotConnected ? (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{hubspotConnection?.accountName || "HubSpot Account"}</p>
                    {hubspotConnection?.lastSyncAt && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {new Date(hubspotConnection.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncHubSpotMutation.mutate()}
                      disabled={syncHubSpotMutation.isPending}
                    >
                      {syncHubSpotMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Sync Contacts
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectHubSpotMutation.mutate()}
                      disabled={disconnectHubSpotMutation.isPending}
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  onClick={() => connectHubSpotMutation.mutate()}
                  disabled={connectHubSpotMutation.isPending}
                >
                  {connectHubSpotMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Connect HubSpot
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Salesforce Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00a1e0]/10 flex items-center justify-center">
                  <SiSalesforce className="w-5 h-5 text-[#00a1e0]" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Salesforce</CardTitle>
                  <CardDescription className="text-xs">
                    Sync contacts and log email activities
                  </CardDescription>
                </div>
              </div>
              {isSalesforceConnected && (
                <Badge variant="outline" className="text-green-500 border-green-500/30">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSalesforceAvailable ? (
              <div className="rounded-lg bg-muted/50 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Setup Required</p>
                    <p className="text-xs text-muted-foreground">
                      Add <code className="px-1 py-0.5 bg-background rounded text-primary">SALESFORCE_CLIENT_ID</code> and{" "}
                      <code className="px-1 py-0.5 bg-background rounded text-primary">SALESFORCE_CLIENT_SECRET</code> to connect.
                    </p>
                  </div>
                </div>
              </div>
            ) : isSalesforceConnected ? (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{salesforceConnection?.accountName || "Salesforce Account"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectSalesforceMutation.mutate()}
                    disabled={disconnectSalesforceMutation.isPending}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  onClick={() => connectSalesforceMutation.mutate()}
                  disabled={connectSalesforceMutation.isPending}
                >
                  {connectSalesforceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Connect Salesforce
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Integrations */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Email Sending</h2>
        
        {/* Gmail Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EA4335]/10 flex items-center justify-center">
                  <SiGmail className="w-5 h-5 text-[#EA4335]" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Gmail</CardTitle>
                  <CardDescription className="text-xs">
                    Send emails directly from your Gmail account
                  </CardDescription>
                </div>
              </div>
              {isGmailConnected && (
                <Badge variant="outline" className="text-green-500 border-green-500/30">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isGmailAvailable ? (
              <div className="rounded-lg bg-muted/50 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Setup Required</p>
                    <p className="text-xs text-muted-foreground">
                      Add <code className="px-1 py-0.5 bg-background rounded text-primary">GOOGLE_CLIENT_ID</code> and{" "}
                      <code className="px-1 py-0.5 bg-background rounded text-primary">GOOGLE_CLIENT_SECRET</code> to connect.
                    </p>
                  </div>
                </div>
              </div>
            ) : isGmailConnected ? (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{gmailConnection?.accountName || "Gmail Account"}</p>
                    <p className="text-xs text-muted-foreground">Ready to send emails</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectGmailMutation.mutate()}
                    disabled={disconnectGmailMutation.isPending}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  onClick={() => connectGmailMutation.mutate()}
                  disabled={connectGmailMutation.isPending}
                >
                  {connectGmailMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Connect Gmail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outlook Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0078D4]/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#0078D4]" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Outlook</CardTitle>
                  <CardDescription className="text-xs">
                    Send emails via Microsoft Outlook
                  </CardDescription>
                </div>
              </div>
              {isOutlookConnected && (
                <Badge variant="outline" className="text-green-500 border-green-500/30">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isOutlookAvailable ? (
              <div className="rounded-lg bg-muted/50 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Setup Required</p>
                    <p className="text-xs text-muted-foreground">
                      Add <code className="px-1 py-0.5 bg-background rounded text-primary">MICROSOFT_CLIENT_ID</code> and{" "}
                      <code className="px-1 py-0.5 bg-background rounded text-primary">MICROSOFT_CLIENT_SECRET</code> to connect.
                    </p>
                  </div>
                </div>
              </div>
            ) : isOutlookConnected ? (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{outlookConnection?.accountName || "Outlook Account"}</p>
                    <p className="text-xs text-muted-foreground">Ready to send emails</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectOutlookMutation.mutate()}
                    disabled={disconnectOutlookMutation.isPending}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  onClick={() => connectOutlookMutation.mutate()}
                  disabled={connectOutlookMutation.isPending}
                >
                  {connectOutlookMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Connect Outlook
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SendGrid Info Card */}
        <Card className="border-border/50 bg-muted/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">SendGrid</CardTitle>
                  <CardDescription className="text-xs">
                    Default email sending service
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              SendGrid is used for sending emails when no personal email account is connected.
              Configure with <code className="px-1 py-0.5 bg-background rounded">SENDGRID_API_KEY</code>.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border/50 p-4 bg-muted/30">
        <h3 className="text-sm font-medium mb-2">What happens when you connect?</h3>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex items-center gap-2">
            <Check className="w-3 h-3 text-primary" />
            CRM connections let you import contacts and log email activities
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-3 h-3 text-primary" />
            Email connections let you send emails directly from your account
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-3 h-3 text-primary" />
            Your data stays secure with OAuth authentication
          </li>
        </ul>
      </div>
    </div>
  );
}
