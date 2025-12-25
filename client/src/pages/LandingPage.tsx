"use client";

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  LandingHeader,
  LandingFooter,
  FeatureCard,
  PricingCard,
  ContactForm,
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from "@/components/landing";
import {
  Zap,
  Mail,
  Users,
  Target,
  Sparkles,
  ArrowRight,
  Upload,
  Brain,
  Send,
  BarChart3,
  Linkedin,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Feature data
const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Generation",
    description:
      "Generate personalized, high-converting sales emails using advanced AI that understands your prospect's context and pain points.",
  },
  {
    icon: Linkedin,
    title: "LinkedIn Enrichment",
    description:
      "Automatically enrich prospect data with LinkedIn insights including job changes, promotions, and company news.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk Campaigns",
    description:
      "Upload CSV files with hundreds of prospects and generate personalized emails for each one in minutes.",
  },
  {
    icon: Target,
    title: "Basho Methodology",
    description:
      "Leverage the proven Basho email framework with trigger-based hooks, consequence of inaction, and clear CTAs.",
  },
];

// How it works steps
const steps = [
  {
    icon: Upload,
    title: "Upload Prospects",
    description: "Add a single prospect or upload a CSV with your entire list.",
  },
  {
    icon: Brain,
    title: "AI Enrichment",
    description:
      "Our AI gathers context from LinkedIn and company data to personalize each email.",
  },
  {
    icon: Mail,
    title: "Generate Emails",
    description:
      "Get perfectly crafted Basho-style emails with personalized triggers and CTAs.",
  },
  {
    icon: Send,
    title: "Send & Track",
    description:
      "Send directly from the platform and track engagement metrics.",
  },
];

// Pricing tiers
const pricingTiers = [
  {
    name: "Starter",
    price: "$0",
    description: "Perfect for trying out Basho Studio",
    features: [
      "50 emails per month",
      "Single email generation",
      "Basic LinkedIn enrichment",
      "Email templates",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$19.99",
    description: "For growing sales teams",
    features: [
      "1,000 emails per month",
      "Bulk CSV campaigns",
      "Advanced AI personalization",
      "Priority LinkedIn enrichment",
      "Email sequences",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: [
      "Unlimited emails",
      "Custom AI training",
      "CRM integrations",
      "Dedicated account manager",
      "SSO & advanced security",
      "Custom SLA",
    ],
    ctaText: "Contact Sales",
  },
];

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handlePricingClick = async (tierName: string) => {
    if (tierName === "Starter") {
      // Free tier - navigate to sign up
      navigate("/sign-up");
      return;
    }

    if (tierName === "Enterprise") {
      // Enterprise - scroll to contact form
      document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (tierName === "Pro") {
      // Pro tier - create checkout session
      setIsCheckoutLoading(true);
      try {
        const response = await apiRequest("POST", "/api/stripe/create-checkout-session");
        
        if (!response.ok) {
          const error = await response.json();
          // If not authenticated, redirect to sign up
          if (response.status === 401) {
            navigate("/sign-up");
            return;
          }
          throw new Error(error.message || "Failed to start checkout");
        }

        const { url } = await response.json();
        
        if (url && url.startsWith("https://")) {
          window.location.href = url;
        } else {
          throw new Error("Invalid checkout URL. Please check Stripe configuration.");
        }
      } catch (error: any) {
        toast({
          title: "Checkout Error",
          description: error?.message || "Could not start checkout. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsCheckoutLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        
        {/* Dot grid pattern */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground)) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
        
        {/* Animated background orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-40 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl"
        />

        {/* Floating decorative elements */}
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-32 left-[10%] hidden lg:block"
        >
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 backdrop-blur-sm" />
        </motion.div>
        <motion.div
          animate={{
            y: [0, 15, 0],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute top-48 right-[8%] hidden lg:block"
        >
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/15 to-transparent border border-primary/10 backdrop-blur-sm" />
        </motion.div>
        <motion.div
          animate={{
            y: [0, -12, 0],
            x: [0, 5, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute bottom-32 left-[15%] hidden lg:block"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20" />
        </motion.div>

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-6">
                <Zap className="w-4 h-4" />
                AI-Powered Sales Outreach
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6"
            >
              Write Sales Emails That{" "}
              <span className="relative">
                <span className="text-primary">Actually Convert</span>
                <motion.span
                  className="absolute -inset-1 bg-primary/20 blur-xl rounded-lg"
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
            >
              Generate personalized, Basho-style sales emails powered by AI. 
              Enrich prospects with LinkedIn data and send high-converting 
              outreach at scale.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/sign-up">
                <Button size="lg" className="gap-2 text-base px-8">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 text-base px-8"
                onClick={() => {
                  document
                    .querySelector("#how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                See How It Works
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mt-16 pt-8 border-t border-border/50"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">10x</div>
                <div className="text-sm text-muted-foreground">Faster Outreach</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">3x</div>
                <div className="text-sm text-muted-foreground">Higher Response Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">50%</div>
                <div className="text-sm text-muted-foreground">Time Saved</div>
              </div>
            </motion.div>
          </div>

          {/* Hero Visual - Email Preview Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-16 max-w-4xl mx-auto"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-1 shadow-2xl shadow-black/20"
            >
              <div className="rounded-lg bg-card p-6">
                {/* Mock email UI */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/50">
                  <div className="w-3 h-3 rounded-full bg-destructive/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  <span className="ml-4 text-sm text-muted-foreground">
                    Generated Email Preview
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Subject:</span>
                    <p className="text-sm font-medium text-foreground">
                      Congrats on the Series B - thoughts on scaling your sales team?
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Body:</span>
                    <div className="text-sm text-muted-foreground mt-1 space-y-2">
                      <p>Hi Sarah,</p>
                      <p>
                        Saw the news about TechCorp's $50M Series B - huge congrats! 
                        With the expansion into enterprise sales you mentioned in your 
                        LinkedIn post, I imagine scaling personalized outreach is top of mind.
                      </p>
                      <p>
                        Most sales teams I work with struggle to maintain that 1:1 feel 
                        when they go from 10 to 100 prospects per day...
                      </p>
                      <p className="text-primary flex items-center gap-1">
                        <span>[AI continues personalized email based on prospect data]</span>
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="inline-block w-0.5 h-4 bg-primary"
                        />
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-4">
              <BarChart3 className="w-4 h-4" />
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
              Everything You Need to Scale Outreach
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful AI tools designed specifically for sales professionals who 
              want to send personalized emails without sacrificing quality.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-4">
              <Users className="w-4 h-4" />
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
              From Prospect to Sent in Minutes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our streamlined workflow helps you generate and send personalized 
              emails faster than ever before.
            </p>
          </AnimatedSection>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <StaggerItem key={step.title}>
                <div className="relative">
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-border to-transparent z-0" />
                  )}
                  
                  <div className="relative z-10 flex flex-col items-center text-center">
                    {/* Step number */}
                    <div className="relative mb-4">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="flex items-center justify-center w-24 h-24 rounded-2xl bg-card border border-border/50 shadow-lg"
                      >
                        <step.icon className="w-10 h-10 text-primary" />
                      </motion.div>
                      <span className="absolute -top-2 -right-2 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {index + 1}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-4">
              <Zap className="w-4 h-4" />
              Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start for free and scale as you grow. No hidden fees, no surprises.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <PricingCard
                key={tier.name}
                name={tier.name}
                price={tier.price}
                description={tier.description}
                features={tier.features}
                highlighted={tier.highlighted}
                ctaText={tier.name === "Pro" && isCheckoutLoading ? "Loading..." : tier.ctaText}
                onCtaClick={() => handlePricingClick(tier.name)}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection direction="right">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-4">
                <Mail className="w-4 h-4" />
                Contact Us
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
                Let's Talk About Your Outreach Goals
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Have questions about Basho Studio? Want to learn more about enterprise 
                features? We'd love to hear from you.
              </p>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Email:</strong>{" "}
                  hello@bashostudio.com
                </p>
                <p>
                  <strong className="text-foreground">Response Time:</strong>{" "}
                  Within 24 hours
                </p>
              </div>
            </AnimatedSection>

            <AnimatedSection direction="left">
              <div className="bg-card/50 border border-border/50 rounded-xl p-8">
                <ContactForm />
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/50 p-12 overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
                Ready to Transform Your Sales Outreach?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of sales professionals who are sending better emails 
                and closing more deals with Basho Studio.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up">
                  <Button size="lg" className="gap-2 text-base px-8">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button variant="outline" size="lg" className="text-base px-8">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      <LandingFooter />
    </div>
  );
}
