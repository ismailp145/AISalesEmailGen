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
import { RefreshCw, Save, X, Copy, Check } from "lucide-react";
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
      title: "Email saved",
      description: "Your changes have been saved successfully.",
    });
    onOpenChange(false);
  };

  const handleCopy = async () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "The email has been copied to your clipboard.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Email Preview
            {prospectName && (
              <span className="text-muted-foreground font-normal">
                for {prospectName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              data-testid="input-email-subject"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
              className="min-h-[300px] font-mono text-sm resize-none"
              data-testid="textarea-email-body"
            />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <div className="flex gap-2 mr-auto">
            <Button
              variant="outline"
              onClick={onRegenerate}
              disabled={isRegenerating}
              data-testid="button-regenerate"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
            <Button
              variant="outline"
              onClick={handleCopy}
              data-testid="button-copy-email"
            >
              {copied ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-email">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
