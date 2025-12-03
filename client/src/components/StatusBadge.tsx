import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProspectStatus = "pending" | "generating" | "ready" | "sent" | "error";

interface StatusBadgeProps {
  status: ProspectStatus;
}

const statusConfig: Record<ProspectStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-transparent text-muted-foreground border-border",
  },
  generating: {
    label: "Generating",
    icon: Loader2,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  ready: {
    label: "Ready",
    icon: Check,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  sent: {
    label: "Sent",
    icon: Send,
    className: "bg-emerald-500/5 text-emerald-400/70 border-emerald-500/10",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[11px] font-medium", config.className)}
      data-testid={`badge-status-${status}`}
    >
      <Icon className={cn("w-3 h-3", status === "generating" && "animate-spin")} />
      {config.label}
    </Badge>
  );
}
