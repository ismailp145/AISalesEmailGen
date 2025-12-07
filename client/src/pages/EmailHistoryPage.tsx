import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Mail, Send, Eye, MessageSquare, RefreshCw, ChevronDown, ChevronUp, Copy, Check, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface EmailActivity {
  id: number;
  prospectId: number;
  subject: string;
  body: string;
  tone: string;
  length: string;
  status: "generated" | "sent" | "opened" | "replied";
  sentAt: string | null;
  createdAt: string;
}

const statusConfig = {
  generated: { label: "Generated", icon: Mail, color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", icon: Send, color: "bg-blue-500/10 text-blue-500" },
  opened: { label: "Opened", icon: Eye, color: "bg-amber-500/10 text-amber-500" },
  replied: { label: "Replied", icon: MessageSquare, color: "bg-green-500/10 text-green-500" },
};

export default function EmailHistoryPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: emails, isLoading, refetch } = useQuery<EmailActivity[]>({
    queryKey: ["/api/emails", statusFilter],
    queryFn: async () => {
      const url = statusFilter !== "all" 
        ? `/api/emails?status=${statusFilter}&limit=100` 
        : "/api/emails?limit=100";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch emails");
      return response.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/emails/${id}`, { status });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      toast({
        title: "Status updated",
        description: "Email status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update email status.",
        variant: "destructive",
      });
    },
  });

  const toggleExpanded = (id: number) => {
    setExpandedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleCopy = async (email: EmailActivity) => {
    const fullEmail = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopiedId(email.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copied",
      description: "Email copied to clipboard.",
    });
  };

  const totalEmails = emails?.length || 0;
  const sentEmails = emails?.filter(e => e.status === "sent").length || 0;
  const openedEmails = emails?.filter(e => e.status === "opened").length || 0;
  const repliedEmails = emails?.filter(e => e.status === "replied").length || 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Email History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage all your generated emails
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Mail className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{totalEmails}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{sentEmails}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{openedEmails}</p>
                <p className="text-xs text-muted-foreground">Opened</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{repliedEmails}</p>
                <p className="text-xs text-muted-foreground">Replied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All emails" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All emails</SelectItem>
            <SelectItem value="generated">Generated</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Email List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : emails && emails.length > 0 ? (
        <div className="space-y-3">
          {emails.map((email) => {
            const status = statusConfig[email.status];
            const StatusIcon = status.icon;
            const isExpanded = expandedEmails.has(email.id);

            return (
              <Collapsible key={email.id} open={isExpanded} onOpenChange={() => toggleExpanded(email.id)}>
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CollapsibleTrigger className="flex items-start gap-3 w-full text-left hover:opacity-80">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">
                              {email.subject}
                            </CardTitle>
                            <div className="flex items-center gap-3 mt-1.5">
                              <Badge variant="outline" className={`text-xs ${status.color}`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(email.createdAt), { addSuffix: true })}
                              </div>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {email.tone}
                              </Badge>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </CollapsibleTrigger>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(email);
                          }}
                        >
                          {copiedId === email.id ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Select 
                          value={email.status} 
                          onValueChange={(value) => updateStatusMutation.mutate({ id: email.id, status: value })}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="generated">Generated</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="opened">Opened</SelectItem>
                            <SelectItem value="replied">Replied</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Separator className="mb-4" />
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                          <p className="text-sm">{email.subject}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
                          <div className="p-3 rounded-md bg-secondary/50 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                            {email.body}
                          </div>
                        </div>
                        {email.sentAt && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Sent: {new Date(email.sentAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <Mail className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <CardTitle className="text-base font-medium mb-1">No emails yet</CardTitle>
            <CardDescription>
              Generated emails will appear here. Start by creating an email on the Single Email page.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
