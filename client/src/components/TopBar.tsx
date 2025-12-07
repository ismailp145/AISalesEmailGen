import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserButton, useUser } from "@clerk/clerk-react";

export function TopBar() {
  const { isSignedIn, user } = useUser();
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  return (
    <header className="flex items-center justify-between gap-4 px-4 h-12 border-b border-border/50">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="w-8 h-8" />
        <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5">
          Sandbox
        </Badge>
      </div>
      {clerkConfigured && isSignedIn ? (
        <UserButton 
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-7 h-7"
            }
          }}
        />
      ) : (
        <Avatar className="w-7 h-7" data-testid="avatar-user">
          <AvatarFallback className="bg-secondary text-xs font-medium">
            {user?.firstName?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
      )}
    </header>
  );
}
