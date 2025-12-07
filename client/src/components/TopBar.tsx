import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserButton, useUser } from "@clerk/clerk-react";

// Separate component for Clerk user - only rendered when ClerkProvider is present
// This ensures useUser() is only called inside ClerkProvider
function ClerkUserSection() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <UserButton 
        afterSignOutUrl="/"
        appearance={{
          elements: {
            avatarBox: "w-7 h-7"
          }
        }}
      />
    );
  }

  // Not signed in - show default avatar
  return <DefaultAvatar />;
}

// Default avatar when Clerk is not configured
function DefaultAvatar() {
  return (
    <Avatar className="w-7 h-7" data-testid="avatar-user">
      <AvatarFallback className="bg-secondary text-xs font-medium">
        U
      </AvatarFallback>
    </Avatar>
  );
}

export function TopBar() {
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  return (
    <header className="flex items-center justify-between gap-4 px-4 h-12 border-b border-border/50">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="w-8 h-8" />
        <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5">
          Sandbox
        </Badge>
      </div>
      {clerkConfigured ? <ClerkUserSection /> : <DefaultAvatar />}
    </header>
  );
}
