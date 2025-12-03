import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Save, Key, Mail, Zap } from "lucide-react";

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
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your AI and email provider settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Configure your AI and email provider API keys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">AI Provider</Label>
            <Select
              value={settings.aiProvider}
              onValueChange={(v) => setSettings({ ...settings, aiProvider: v })}
            >
              <SelectTrigger id="ai-provider" data-testid="select-ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="mock">Mock (Testing)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              AI API key is configured via environment variables
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="email-provider">Email Provider</Label>
            <Select
              value={settings.emailProvider}
              onValueChange={(v) => setSettings({ ...settings, emailProvider: v })}
            >
              <SelectTrigger id="email-provider" data-testid="select-email-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="ses">AWS SES</SelectItem>
                <SelectItem value="postmark">Postmark</SelectItem>
                <SelectItem value="mock">Mock (Testing)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Email provider API key is configured via environment variables
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Defaults
          </CardTitle>
          <CardDescription>
            Set default values for email generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-tone">Default Tone</Label>
              <Select
                value={settings.defaultTone}
                onValueChange={(v) => setSettings({ ...settings, defaultTone: v })}
              >
                <SelectTrigger id="default-tone" data-testid="select-default-tone">
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
              <Label htmlFor="default-length">Default Length</Label>
              <Select
                value={settings.defaultLength}
                onValueChange={(v) => setSettings({ ...settings, defaultLength: v })}
              >
                <SelectTrigger id="default-length" data-testid="select-default-length">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Performance
          </CardTitle>
          <CardDescription>
            Configure batch processing and enrichment settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-enrich LinkedIn profiles</Label>
              <p className="text-sm text-muted-foreground">
                Automatically fetch LinkedIn data when available
              </p>
            </div>
            <Switch
              checked={settings.autoEnrichLinkedIn}
              onCheckedChange={(v) => setSettings({ ...settings, autoEnrichLinkedIn: v })}
              data-testid="switch-auto-enrich"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="concurrency">Batch Concurrency Limit</Label>
            <Select
              value={settings.concurrencyLimit}
              onValueChange={(v) => setSettings({ ...settings, concurrencyLimit: v })}
            >
              <SelectTrigger id="concurrency" data-testid="select-concurrency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 (Sequential)</SelectItem>
                <SelectItem value="3">3 (Conservative)</SelectItem>
                <SelectItem value="5">5 (Balanced)</SelectItem>
                <SelectItem value="10">10 (Fast)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Number of prospects to process simultaneously during batch generation
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} data-testid="button-save-settings">
          {saving ? (
            <>Saving...</>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
