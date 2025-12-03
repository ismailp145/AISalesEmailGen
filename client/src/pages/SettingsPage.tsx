import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // todo: remove mock functionality - load from actual settings
  const [settings, setSettings] = useState({
    aiProvider: "openai",
    emailProvider: "mock",
    defaultTone: "professional",
    defaultLength: "medium",
    autoEnrichLinkedIn: true,
    concurrencyLimit: "5",
  });

  const handleSave = async () => {
    setSaving(true);
    // todo: remove mock functionality - save to actual backend
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    toast({
      title: "Saved",
      description: "Settings updated.",
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AI and email provider settings
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ai-provider" className="text-xs text-muted-foreground">AI Provider</Label>
            <Select
              value={settings.aiProvider}
              onValueChange={(v) => setSettings({ ...settings, aiProvider: v })}
            >
              <SelectTrigger id="ai-provider" className="h-9" data-testid="select-ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="mock">Mock (Testing)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border/50" />

          <div className="space-y-2">
            <Label htmlFor="email-provider" className="text-xs text-muted-foreground">Email Provider</Label>
            <Select
              value={settings.emailProvider}
              onValueChange={(v) => setSettings({ ...settings, emailProvider: v })}
            >
              <SelectTrigger id="email-provider" className="h-9" data-testid="select-email-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="ses">AWS SES</SelectItem>
                <SelectItem value="postmark">Postmark</SelectItem>
                <SelectItem value="mock">Mock (Testing)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Email Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-tone" className="text-xs text-muted-foreground">Default Tone</Label>
              <Select
                value={settings.defaultTone}
                onValueChange={(v) => setSettings({ ...settings, defaultTone: v })}
              >
                <SelectTrigger id="default-tone" className="h-9" data-testid="select-default-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="hyper-personal">Hyper-Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-length" className="text-xs text-muted-foreground">Default Length</Label>
              <Select
                value={settings.defaultLength}
                onValueChange={(v) => setSettings({ ...settings, defaultLength: v })}
              >
                <SelectTrigger id="default-length" className="h-9" data-testid="select-default-length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-enrich LinkedIn</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fetch LinkedIn data when available
              </p>
            </div>
            <Switch
              checked={settings.autoEnrichLinkedIn}
              onCheckedChange={(v) => setSettings({ ...settings, autoEnrichLinkedIn: v })}
              data-testid="switch-auto-enrich"
            />
          </div>

          <Separator className="bg-border/50" />

          <div className="space-y-2">
            <Label htmlFor="concurrency" className="text-xs text-muted-foreground">Concurrency Limit</Label>
            <Select
              value={settings.concurrencyLimit}
              onValueChange={(v) => setSettings({ ...settings, concurrencyLimit: v })}
            >
              <SelectTrigger id="concurrency" className="h-9" data-testid="select-concurrency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 (Sequential)</SelectItem>
                <SelectItem value="3">3 (Conservative)</SelectItem>
                <SelectItem value="5">5 (Balanced)</SelectItem>
                <SelectItem value="10">10 (Fast)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" data-testid="button-save-settings">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
