"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaText?: string;
  onCtaClick?: () => void;
  index?: number;
}

export function PricingCard({
  name,
  price,
  period = "/month",
  description,
  features,
  highlighted = false,
  ctaText = "Get Started",
  onCtaClick,
  index = 0,
}: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.15,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      whileHover={{ 
        y: -8, 
        boxShadow: highlighted 
          ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)" 
          : "0 20px 40px -12px rgba(0, 0, 0, 0.4)",
        transition: { duration: 0.3 } 
      }}
      className={cn(
        "relative flex flex-col p-6 rounded-xl border transition-all duration-300",
        highlighted
          ? "bg-card border-primary/50 shadow-xl shadow-primary/10"
          : "bg-card/50 border-border/50 hover:border-border"
      )}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">{name}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-foreground">{price}</span>
        {price !== "Custom" && (
          <span className="text-muted-foreground">{period}</span>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={highlighted ? "default" : "outline"}
        className="w-full"
        onClick={onCtaClick}
      >
        {ctaText}
      </Button>
    </motion.div>
  );
}
