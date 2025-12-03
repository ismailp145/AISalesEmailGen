import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import NotFound from "@/pages/not-found";
import SingleEmailPage from "@/pages/SingleEmailPage";
import BulkCampaignsPage from "@/pages/BulkCampaignsPage";
import SequencesPage from "@/pages/SequencesPage";
import SettingsPage from "@/pages/SettingsPage";
import IntegrationsPage from "@/pages/IntegrationsPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SingleEmailPage} />
      <Route path="/bulk" component={BulkCampaignsPage} />
      <Route path="/sequences" component={SequencesPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
