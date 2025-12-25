import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Copy, Send, RefreshCw, Check, Search, Newspaper, Linkedin, Building, TrendingUp, Briefcase, DollarSign, X, AlertTriangle, Crown, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DetectedTrigger, TriggerType } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  company: z.string().min(1, "Required"),
  title: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  linkedinUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  companyWebsite: z.string().url("Invalid URL").optional().or(z.literal("")),
  linkedinContent: z.string().optional(),
  notes: z.string().optional(),
  tone: z.enum(["casual", "professional", "hyper-personal"]),
  length: z.enum(["short", "medium"]),
});

type FormData = z.infer<typeof formSchema>;

interface GeneratedEmail {
  subject: string;
  body: string;
}

interface DetectTriggersResponse {
  triggers: DetectedTrigger[];
  prospectSummary: string;
}

const triggerTypeConfig: Record<TriggerType, { icon: typeof Newspaper; label: string }> = {
  news: { icon: Newspaper, label: "News" },
  linkedin: { icon: Linkedin, label: "LinkedIn" },
  company_event: { icon: Building, label: "Company Event" },
  industry_trend: { icon: TrendingUp, label: "Industry Trend" },
  job_change: { icon: Briefcase, label: "Job Change" },
  funding: { icon: DollarSign, label: "Funding" },
};

const relevanceColors = {
  high: "bg-primary/10 text-primary border-primary/20",
  medium: "bg-muted text-muted-foreground border-border",
  low: "bg-muted/50 text-muted-foreground/70 border-border/50",
};

// Subscription info type
interface SubscriptionInfo {
  subscriptionTier: "free" | "pro" | "enterprise";
  emailsUsedThisMonth: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  limits: {
    emailsUsed: number;
    emailsLimit: number;
    tier: "free" | "pro" | "enterprise";
  };
  freeTrial?: {
    isActive: boolean;
    daysRemaining: number;
    hasExpired: boolean;
    endsAt: string | null;
  };
}

export function SingleEmailForm() {
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [triggers, setTriggers] = useState<DetectedTrigger[]>([]);
  const [prospectSummary, setProspectSummary] = useState("");
  const [showTriggers, setShowTriggers] = useState(false);
  const { toast } = useToast();

  const [showLinkedInContent, setShowLinkedInContent] = useState(false);
  
  // Fetch subscription info
  const { data: subscription } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      title: "",
      email: "",
      linkedinUrl: "",
      companyWebsite: "",
      linkedinContent: "",
      notes: "",
      tone: "professional",
      length: "medium",
    },
  });

  const detectTriggersMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/detect-triggers", {
        prospect: {
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          title: data.title,
          email: data.email,
          linkedinUrl: data.linkedinUrl || undefined,
          notes: data.notes || undefined,
        },
        companyWebsite: data.companyWebsite || undefined,
      });
      return response.json() as Promise<DetectTriggersResponse>;
    },
    onSuccess: (result) => {
      setTriggers(result.triggers);
      setProspectSummary(result.prospectSummary);
      setShowTriggers(true);
      toast({
        title: "Triggers detected",
        description: `Found ${result.triggers.length} potential conversation starters.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Detection failed",
        description: error?.message || "Could not detect triggers. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const selectedTriggers = triggers.filter(t => t.selected);
      const response = await apiRequest("POST", "/api/generate-email", {
        prospect: {
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          title: data.title,
          email: data.email,
          linkedinUrl: data.linkedinUrl || undefined,
          notes: data.notes || undefined,
        },
        tone: data.tone,
        length: data.length,
        triggers: selectedTriggers.length > 0 ? selectedTriggers : undefined,
        linkedinContent: data.linkedinContent || undefined,
      });
      return response.json() as Promise<GeneratedEmail>;
    },
    onSuccess: (email) => {
      setGeneratedEmail(email);
      // Refresh subscription data to update usage counts
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Email generated",
        description: "Your Basho email is ready to review.",
      });
    },
    onError: (error: any) => {
      // Check if it's a limit exceeded error
      const isLimitError = error?.message?.includes("limit") || error?.message?.includes("credits");
      toast({
        title: isLimitError ? "Limit reached" : "Generation failed",
        description: error?.message || "Could not generate email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (params: { to: string; from: string; subject: string; body: string }) => {
      const response = await apiRequest("POST", "/api/send-email", params);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send email");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowSendDialog(false);
      setSenderEmail("");
      toast({
        title: "Email sent",
        description: `Email delivered to ${form.getValues("email")}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Send failed",
        description: error?.message || "Could not send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    generateMutation.mutate(data);
  };

  const handleDetectTriggers = () => {
    const data = form.getValues();
    const isValid = data.firstName && data.lastName && data.company && data.title;
    if (!isValid) {
      toast({
        title: "Missing information",
        description: "Please fill in prospect details before detecting triggers.",
        variant: "destructive",
      });
      return;
    }
    detectTriggersMutation.mutate(data);
  };

  const handleTriggerToggle = (triggerId: string) => {
    setTriggers(prev =>
      prev.map(t =>
        t.id === triggerId ? { ...t, selected: !t.selected } : t
      )
    );
  };

  const handleClearTriggers = () => {
    setTriggers([]);
    setProspectSummary("");
    setShowTriggers(false);
  };

  const handleCopy = async () => {
    if (!generatedEmail) return;
    const fullEmail = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Email copied to clipboard.",
    });
  };

  const handleSend = () => {
    setShowSendDialog(true);
  };

  const handleConfirmSend = () => {
    if (!generatedEmail || !senderEmail) return;
    
    sendMutation.mutate({
      to: form.getValues("email"),
      from: senderEmail,
      subject: generatedEmail.subject,
      body: generatedEmail.body,
    });
  };

  const handleRegenerate = () => {
    form.handleSubmit(onSubmit)();
  };

  const isGenerating = generateMutation.isPending;
  const isDetecting = detectTriggersMutation.isPending;
  const selectedTriggerCount = triggers.filter(t => t.selected).length;

  // Calculate usage info
  const emailsUsed = subscription?.limits?.emailsUsed ?? 0;
  const emailsLimit = subscription?.limits?.emailsLimit ?? 50;
  const usagePercent = Math.min((emailsUsed / emailsLimit) * 100, 100);
  const remaining = emailsLimit - emailsUsed;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = remaining <= 0;
  const isTrialUser = subscription?.freeTrial?.isActive ?? false;
  const trialDaysRemaining = subscription?.freeTrial?.daysRemaining ?? 0;

  return (
    <div className="space-y-6">
      {/* Email Usage Display */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Monthly Email Credits</span>
              {isTrialUser && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  Trial: {trialDaysRemaining} days left
                </Badge>
              )}
            </div>
            <span className="text-sm font-medium">
              {emailsUsed} / {emailsLimit}
            </span>
          </div>
          <Progress 
            value={usagePercent} 
            className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}`}
          />
          {isNearLimit && !isAtLimit && (
            <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              You're approaching your monthly limit
              {subscription?.limits?.tier === "free" && (
                <a href="/settings" className="underline ml-1 font-medium">Upgrade to Pro</a>
              )}
            </p>
          )}
          {isAtLimit && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Limit reached</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>You've used all your email credits for this month.</span>
                <Button asChild variant="outline" size="sm" className="ml-2">
                  <a href="/settings">
                    <Crown className="h-3 w-3 mr-1" />
                    Upgrade
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Prospect Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Sarah" className="h-9" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Johnson" className="h-9" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" className="h-9" {...field} data-testid="input-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Title</FormLabel>
                      <FormControl>
                        <Input placeholder="VP of Sales" className="h-9" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="sarah@acme.com" 
                          className="h-9"
                          {...field} 
                          data-testid="input-email" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="linkedin.com/in/sarah" 
                          className="h-9"
                          {...field} 
                          data-testid="input-linkedin" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="companyWebsite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Company Website (optional)
                      <span className="ml-2 text-primary">✨ Enhanced triggers</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://acme.com" 
                        className="h-9"
                        {...field} 
                        data-testid="input-company-website" 
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground mt-1">
                      We'll scrape their website and search for recent news to find real, specific triggers
                    </p>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Tone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" data-testid="select-tone">
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="hyper-personal">Hyper-Personal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Length</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" data-testid="select-length">
                            <SelectValue placeholder="Select length" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="short">Short</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* LinkedIn Profile Data Section */}
              <Collapsible open={showLinkedInContent} onOpenChange={setShowLinkedInContent}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="w-full justify-between h-9 text-xs"
                    data-testid="button-toggle-linkedin"
                  >
                    <div className="flex items-center gap-2">
                      <Linkedin className="w-4 h-4" />
                      LinkedIn Profile Data
                      {form.watch("linkedinContent") && (
                        <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                          Added
                        </Badge>
                      )}
                    </div>
                    {showLinkedInContent ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Click to expand</span>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <FormField
                    control={form.control}
                    name="linkedinContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Paste LinkedIn profile content here...

Include their:
• Headline and current role
• About section
• Recent posts or articles
• Experience highlights
• Skills or certifications

This helps generate hyper-personalized emails."
                            className="resize-none min-h-[150px] text-sm"
                            {...field}
                            data-testid="textarea-linkedin-content"
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground mt-2">
                          Copy and paste content from their LinkedIn profile for deeper personalization.
                        </p>
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Context (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any talking points or context..."
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDetectTriggers}
                  disabled={isDetecting || isGenerating || isAtLimit}
                  className="flex-1"
                  data-testid="button-detect-triggers"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finding Triggers...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Find Triggers
                    </>
                  )}
                </Button>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1">
                        <Button 
                          type="submit" 
                          disabled={isGenerating || isDetecting || isAtLimit} 
                          className="w-full"
                          data-testid="button-generate"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate Email
                              {selectedTriggerCount > 0 && (
                                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                                  +{selectedTriggerCount}
                                </Badge>
                              )}
                            </>
                          )}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {isAtLimit && (
                      <TooltipContent>
                        <p className="font-medium">Upgrade required to continue</p>
                        <p className="text-xs text-muted-foreground">You've reached your monthly limit</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {triggers.length > 0 && (
        <Collapsible open={showTriggers} onOpenChange={setShowTriggers}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                    <CardTitle className="text-lg font-medium">
                      Detected Triggers
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {selectedTriggerCount}/{triggers.length} selected
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearTriggers}
                  data-testid="button-clear-triggers"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {prospectSummary && (
                <p className="text-sm text-muted-foreground mt-2">
                  {prospectSummary}
                </p>
              )}
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {triggers.map((trigger) => {
                  const config = triggerTypeConfig[trigger.type];
                  const IconComponent = config.icon;
                  return (
                    <div
                      key={trigger.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        trigger.selected 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border/50 hover:border-border"
                      }`}
                      onClick={() => handleTriggerToggle(trigger.id)}
                      data-testid={`trigger-item-${trigger.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={trigger.selected}
                          onCheckedChange={() => handleTriggerToggle(trigger.id)}
                          className="mt-0.5"
                          data-testid={`checkbox-trigger-${trigger.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${relevanceColors[trigger.relevance]}`}
                            >
                              <IconComponent className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs capitalize ${relevanceColors[trigger.relevance]}`}
                            >
                              {trigger.relevance}
                            </Badge>
                            {trigger.date && (
                              <span className="text-xs text-muted-foreground">
                                {trigger.date}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-medium mb-1">{trigger.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {trigger.description}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Source: {trigger.source}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {generatedEmail && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg font-medium">Generated Email</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  data-testid="button-regenerate"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  data-testid="button-copy"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  data-testid="button-send"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <div className="text-sm font-medium" data-testid="text-generated-subject">
                {generatedEmail.subject}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Body</Label>
              <div 
                className="p-4 rounded-md bg-secondary/50 font-mono text-sm whitespace-pre-wrap leading-relaxed"
                data-testid="text-generated-body"
              >
                {generatedEmail.body}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Enter your verified SendGrid sender email to send this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="from-email">From (your email)</Label>
              <Input
                id="from-email"
                type="email"
                placeholder="you@yourcompany.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                data-testid="input-sender-email"
              />
              <p className="text-xs text-muted-foreground">
                This must be a verified sender in your SendGrid account
              </p>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <div className="text-sm text-muted-foreground">
                {form.getValues("email")}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <div className="text-sm text-muted-foreground truncate">
                {generatedEmail?.subject}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSendDialog(false)}
              data-testid="button-cancel-send"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={!senderEmail || sendMutation.isPending}
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
