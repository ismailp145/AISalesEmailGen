import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, Save, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailData {
  subject: string;
  body: string;
}

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailData | null;
  prospectName?: string;
  onSave: (email: EmailData) => void;
  onRegenerate: () => void;
  isRegenerating?: boolean;
}

export function EmailPreviewModal({
  open,
  onOpenChange,
  email,
  prospectName,
  onSave,
  onRegenerate,
  isRegenerating = false,
}: EmailPreviewModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (email) {
      setSubject(email.subject);
      setBody(email.body);
    }
  }, [email]);

  const handleSave = () => {
    onSave({ subject, body });
    toast({
      title: "Saved",
      description: "Changes saved.",
    });
    onOpenChange(false);
  };

  const handleCopy = async () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Email copied to clipboard.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Edit Email
            {prospectName && (
              <span className="text-muted-foreground font-normal ml-2">
                for {prospectName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="subject" className="text-xs text-muted-foreground">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9"
              data-testid="input-email-subject"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body" className="text-xs text-muted-foreground">Body</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[280px] font-mono text-sm resize-none"
              data-testid="textarea-email-body"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <div className="flex gap-2 mr-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
              data-testid="button-regenerate"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              data-testid="button-copy-email"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} data-testid="button-save-email">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
