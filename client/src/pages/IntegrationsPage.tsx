import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Link2, Unlink, RefreshCw, Check, AlertCircle, ExternalLink } from "lucide-react";
import { SiHubspot, SiSalesforce } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    pipedrive: boolean;
  };
}

export default function IntegrationsPage() {
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<CrmConnectionsResponse>({
    queryKey: ["/api/crm/connections"],
  });

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

  const hubspotConnection = data?.connections.find(c => c.provider === "hubspot");
  const isHubSpotAvailable = data?.available.hubspot;
  const isHubSpotConnected = hubspotConnection?.isActive;

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
          Connect your CRM to sync contacts and log email activities automatically
        </p>
      </div>

      <div className="space-y-4">
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
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">API Key Required</p>
                    <p className="text-xs text-muted-foreground">
                      To connect HubSpot, you need to create a Private App and add the API key.
                    </p>
                  </div>
                </div>
                <div className="pl-8 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    1. Go to your HubSpot account Settings
                  </p>
                  <p className="text-xs text-muted-foreground">
                    2. Navigate to Integrations → Private Apps
                  </p>
                  <p className="text-xs text-muted-foreground">
                    3. Create a new Private App with CRM scopes (contacts read/write)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    4. Copy the access token and add it to Replit Secrets as <code className="px-1 py-0.5 bg-background rounded text-primary">HUBSPOT_API_KEY</code>
                  </p>
                </div>
                <div className="pl-8">
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href="https://developers.hubspot.com/docs/api/private-apps" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="link-hubspot-docs"
                    >
                      <ExternalLink className="w-3 h-3 mr-2" />
                      View HubSpot Docs
                    </a>
                  </Button>
                </div>
              </div>
            ) : isHubSpotConnected ? (
              <div className="space-y-4">
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
                        data-testid="button-sync-hubspot"
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
                        data-testid="button-disconnect-hubspot"
                      >
                        {disconnectHubSpotMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Unlink className="w-4 h-4 mr-2" />
                        )}
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  onClick={() => connectHubSpotMutation.mutate()}
                  disabled={connectHubSpotMutation.isPending}
                  data-testid="button-connect-hubspot"
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

        <Card className="border-border/50 opacity-60">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00a1e0]/10 flex items-center justify-center">
                  <SiSalesforce className="w-5 h-5 text-[#00a1e0]" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Salesforce</CardTitle>
                  <CardDescription className="text-xs">
                    Coming soon
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/50 opacity-60">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#28292b]/50 flex items-center justify-center">
                  <span className="text-lg font-bold text-foreground">P</span>
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Pipedrive</CardTitle>
                  <CardDescription className="text-xs">
                    Coming soon
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="rounded-lg border border-border/50 p-4 bg-muted/30">
        <h3 className="text-sm font-medium mb-2">What happens when you connect a CRM?</h3>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex items-center gap-2">
            <Check className="w-3 h-3 text-primary" />
            Import contacts directly instead of uploading CSV files
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-3 h-3 text-primary" />
            Email activities are logged back to your CRM automatically
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-3 h-3 text-primary" />
            Keep your prospect data in sync between systems
          </li>
        </ul>
      </div>
    </div>
  );
}
