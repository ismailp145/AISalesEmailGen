import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4 px-4 h-12 border-b border-border/50">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="w-8 h-8" />
        <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5">
          Sandbox
        </Badge>
      </div>
      <Avatar className="w-7 h-7" data-testid="avatar-user">
        <AvatarFallback className="bg-secondary text-xs font-medium">
          U
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
