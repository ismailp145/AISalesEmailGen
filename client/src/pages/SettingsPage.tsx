import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Loader2, Save, User, Building2, Package, Target, Sparkles, CreditCard, Crown, Check, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { userProfileSchema, type UserProfile, defaultUserProfile, SUBSCRIPTION_LIMITS } from "@shared/schema";

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
}

export default function SettingsPage() {
  const { toast } = useToast();
  const searchString = useSearch();
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: subscription, isLoading: isSubscriptionLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
  });

  // Handle subscription success/cancel URL parameters
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const subscriptionStatus = params.get("subscription");
    
    if (subscriptionStatus === "success") {
      toast({
        title: "Subscription Activated!",
        description: "Welcome to Pro! Your subscription is now active.",
      });
      // Clean up URL
      window.history.replaceState({}, "", "/settings");
      // Refresh subscription data
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    } else if (subscriptionStatus === "cancelled") {
      toast({
        title: "Checkout Cancelled",
        description: "You can upgrade anytime from this page.",
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchString, toast]);

  const form = useForm<UserProfile>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: defaultUserProfile,
  });

  useEffect(() => {
    if (profile) {
      form.reset(profile);
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: UserProfile) => {
      const response = await apiRequest("POST", "/api/profile", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error?.message || "Could not save profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const autoFillMutation = useMutation({
    mutationFn: async () => {
      const companyWebsite = form.getValues("companyWebsite");
      const companyName = form.getValues("companyName");

      if (!companyWebsite || !companyName) {
        throw new Error("Please enter both company name and website URL first");
      }

      const response = await apiRequest("POST", "/api/profile/auto-fill", {
        companyWebsite,
        companyName,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to auto-fill profile");
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      const { extractedFields, fieldsCount } = data;
      const newAutoFilledFields = new Set<string>();

      // Merge extracted fields into form
      Object.entries(extractedFields).forEach(([key, value]) => {
        if (value && typeof value === "string" && value.trim()) {
          form.setValue(key as keyof UserProfile, value as any);
          newAutoFilledFields.add(key);
        }
      });

      setAutoFilledFields(newAutoFilledFields);

      toast({
        title: "Profile auto-filled",
        description: `Successfully extracted ${fieldsCount} fields from your website. Review and save when ready.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Auto-fill failed",
        description: error?.message || "Could not auto-fill profile. Please try again or fill in manually.",
        variant: "destructive",
      });
    },
  });

  // Stripe checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stripe/create-checkout-session");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create checkout session");
      }
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url && data.url.startsWith("https://")) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Checkout Error",
          description: "Invalid checkout URL received. Please check your Stripe configuration.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error?.message || "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stripe portal mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stripe/create-portal-session");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to open billing portal");
      }
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Portal Error",
        description: error?.message || "Could not open billing portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAutoFill = () => {
    autoFillMutation.mutate();
  };

  const handleUpgrade = () => {
    checkoutMutation.mutate();
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  const onSubmit = (data: UserProfile) => {
    saveMutation.mutate(data);
    setAutoFilledFields(new Set()); // Clear auto-filled indicators after save
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate usage percentage
  const emailsUsed = subscription?.limits?.emailsUsed || 0;
  const emailsLimit = subscription?.limits?.emailsLimit || 50;
  const usagePercentage = Math.min((emailsUsed / emailsLimit) * 100, 100);
  const tier = subscription?.subscriptionTier || "free";
  const isPro = tier === "pro";
  const isEnterprise = tier === "enterprise";
  const hasStripeSubscription = !!subscription?.stripeSubscriptionId;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and profile settings
        </p>
      </div>

      {/* Billing Section */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-medium">Subscription & Billing</CardTitle>
            </div>
            <Badge 
              variant={isPro || isEnterprise ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              {(isPro || isEnterprise) && <Crown className="w-3 h-3" />}
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Manage your subscription plan and billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSubscriptionLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Usage Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Emails this month</span>
                  <span className="font-medium">
                    {emailsUsed} / {emailsLimit === -1 ? "Unlimited" : emailsLimit}
                  </span>
                </div>
                {emailsLimit !== -1 && (
                  <Progress value={usagePercentage} className="h-2" />
                )}
              </div>

              {/* Plan Details */}
              <div className="rounded-lg border border-border/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">
                      {tier === "free" && "Free Plan"}
                      {tier === "pro" && "Pro Plan"}
                      {tier === "enterprise" && "Enterprise Plan"}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {tier === "free" && "50 emails/month, basic features"}
                      {tier === "pro" && "$49/month • 1,000 emails/month, all features"}
                      {tier === "enterprise" && "Custom pricing • Unlimited emails"}
                    </p>
                  </div>
                </div>

                {tier === "free" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Upgrade to Pro for bulk campaigns, sequences, and more.
                    </p>
                    <ul className="text-sm space-y-1">
                      {["1,000 emails/month", "Bulk CSV campaigns", "Email sequences", "Priority support"].map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-muted-foreground">
                          <Check className="w-3 h-3 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {tier === "free" ? (
                  <Button 
                    onClick={handleUpgrade}
                    disabled={checkoutMutation.isPending}
                    className="gap-2"
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Crown className="w-4 h-4" />
                    )}
                    Upgrade to Pro
                  </Button>
                ) : hasStripeSubscription ? (
                  <Button 
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={portalMutation.isPending}
                    className="gap-2"
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Manage Subscription
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Profile Section Header */}
      <div>
        <h2 className="text-lg font-medium tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about yourself and your company so the AI can write better emails
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">About You</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Your personal details for email signatures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="senderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Your Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Alex Johnson" className="h-9" {...field} data-testid="input-sender-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="senderTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Your Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Account Executive" className="h-9" {...field} data-testid="input-sender-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="senderEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Your Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="alex@company.com" className="h-9" {...field} data-testid="input-sender-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="calendarLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Calendar Link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://calendly.com/alex" className="h-9" {...field} data-testid="input-calendar-link" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Your Company</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Details about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc" className="h-9" {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Industry</FormLabel>
                      <FormControl>
                        <Input placeholder="SaaS / Technology" className="h-9" {...field} data-testid="input-industry" />
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
                    <FormLabel className="text-xs text-muted-foreground">Company Website</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="https://acme.com" className="h-9" {...field} data-testid="input-company-website" />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoFill}
                        disabled={autoFillMutation.isPending || !field.value || !form.getValues("companyName")}
                        className="whitespace-nowrap"
                        data-testid="button-auto-fill"
                      >
                        {autoFillMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Auto-filling...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Auto-fill
                          </>
                        )}
                      </Button>
                    </div>
                    <FormDescription className="text-xs">
                      Click Auto-fill to extract company information from your website
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Company Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of what your company does..."
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-company-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Product / Service</CardTitle>
              </div>
              <CardDescription className="text-xs">
                What you're selling to prospects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Platform" className="h-9" {...field} data-testid="input-product-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Target Audience</FormLabel>
                      <FormControl>
                        <Input placeholder="VP of Sales, Revenue Leaders" className="h-9" {...field} data-testid="input-target-audience" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="productDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Product Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What does your product do? What problem does it solve?"
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-product-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valueProposition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Value Proposition</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What's the main benefit? Why should prospects care?"
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-value-prop"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      The key benefit or outcome your product delivers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-medium">Sales Context</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Talking points to make emails more compelling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="painPoints"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Pain Points You Solve</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What problems do your customers face that you solve? (one per line)"
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-pain-points"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="differentiators"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Differentiators</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What makes you different from competitors?"
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-differentiators"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="socialProof"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Social Proof</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Customer names, case study results, awards, metrics..."
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-social-proof"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Examples: "Used by 500+ companies" or "Helped Company X increase revenue by 40%"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commonObjections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Common Objections</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What objections do prospects typically raise?"
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-objections"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Helps the AI preemptively address concerns
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-profile">
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
