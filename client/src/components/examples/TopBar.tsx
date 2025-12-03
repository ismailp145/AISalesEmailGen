import { SidebarProvider } from "@/components/ui/sidebar";
import { TopBar } from "../TopBar";

export default function TopBarExample() {
  return (
    <SidebarProvider>
      <div className="w-full">
        <TopBar />
      </div>
    </SidebarProvider>
  );
}
