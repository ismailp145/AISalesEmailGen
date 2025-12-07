import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";
import NotFound from "@/pages/not-found";
import SingleEmailPage from "@/pages/SingleEmailPage";
import BulkCampaignsPage from "@/pages/BulkCampaignsPage";
import SequencesPage from "@/pages/SequencesPage";
import SettingsPage from "@/pages/SettingsPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import EmailHistoryPage from "@/pages/EmailHistoryPage";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SingleEmailPage} />
      <Route path="/bulk" component={BulkCampaignsPage} />
      <Route path="/history" component={EmailHistoryPage} />
      <Route path="/sequences" component={SequencesPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedApp() {
  return (
    <AppLayout>
      <Router />
    </AppLayout>
  );
}

function UnauthenticatedApp() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
            <span className="text-xl text-primary-foreground">⚡</span>
          </div>
          <span className="text-2xl font-semibold tracking-tight">
            Basho Studio
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          AI-Powered Sales Emails
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Generate highly personalized cold outreach emails that get responses. 
          Basho-style emails with deep personalization.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <SignInButton mode="modal">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6">
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}

function App() {
  // Check if Clerk is configured
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  
  // If Clerk is not configured, show the app without auth
  if (!clerkKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppLayout>
            <Router />
          </AppLayout>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // With Clerk configured, use SignedIn/SignedOut
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SignedOut>
          <UnauthenticatedApp />
        </SignedOut>
        <SignedIn>
          <AuthenticatedApp />
        </SignedIn>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
