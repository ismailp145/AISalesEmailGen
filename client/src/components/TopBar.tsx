import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4 px-4 h-14 border-b border-border bg-background">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <Badge variant="outline" className="text-xs font-medium">
          Sandbox
        </Badge>
      </div>
      <Avatar className="w-8 h-8" data-testid="avatar-user">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <User className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
