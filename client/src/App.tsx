import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
      {/* Public routes - accessible without authentication */}
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      
      {/* Protected routes - require authentication */}
      <Route path="/">
        <ProtectedRoute>
          <SingleEmailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/bulk">
        <ProtectedRoute>
          <BulkCampaignsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/history">
        <ProtectedRoute>
          <EmailHistoryPage />
        </ProtectedRoute>
      </Route>
      <Route path="/sequences">
        <ProtectedRoute>
          <SequencesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/integrations">
        <ProtectedRoute>
          <IntegrationsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
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

function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isAuthPage = location === "/sign-in" || location === "/sign-up";

  // Don't show sidebar/layout for auth pages
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Show full layout for protected pages
  return <AppLayout>{children}</AppLayout>;
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

  // With Clerk configured, routes are protected via ProtectedRoute component
  // Unauthenticated users will be redirected to sign-in automatically
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConditionalLayout>
          <Router />
        </ConditionalLayout>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
