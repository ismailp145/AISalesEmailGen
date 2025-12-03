import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, Copy, Send, RefreshCw, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  company: z.string().min(1, "Required"),
  title: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  linkedinUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  notes: z.string().optional(),
  tone: z.enum(["casual", "professional", "hyper-personal"]),
  length: z.enum(["short", "medium"]),
});

type FormData = z.infer<typeof formSchema>;

interface GeneratedEmail {
  subject: string;
  body: string;
}

export function SingleEmailForm() {
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      title: "",
      email: "",
      linkedinUrl: "",
      notes: "",
      tone: "professional",
      length: "medium",
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/generate-email", {
        prospect: {
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          title: data.title,
          email: data.email,
          linkedinUrl: data.linkedinUrl || undefined,
          notes: data.notes || undefined,
        },
        tone: data.tone,
        length: data.length,
      });
      return response.json() as Promise<GeneratedEmail>;
    },
    onSuccess: (email) => {
      setGeneratedEmail(email);
      toast({
        title: "Email generated",
        description: "Your Basho email is ready to review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error?.message || "Could not generate email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (params: { to: string; from: string; subject: string; body: string }) => {
      const response = await apiRequest("POST", "/api/send-email", params);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send email");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowSendDialog(false);
      setSenderEmail("");
      toast({
        title: "Email sent",
        description: `Email delivered to ${form.getValues("email")}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Send failed",
        description: error?.message || "Could not send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    generateMutation.mutate(data);
  };

  const handleCopy = async () => {
    if (!generatedEmail) return;
    const fullEmail = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Email copied to clipboard.",
    });
  };

  const handleSend = () => {
    setShowSendDialog(true);
  };

  const handleConfirmSend = () => {
    if (!generatedEmail || !senderEmail) return;
    
    sendMutation.mutate({
      to: form.getValues("email"),
      from: senderEmail,
      subject: generatedEmail.subject,
      body: generatedEmail.body,
    });
  };

  const handleRegenerate = () => {
    form.handleSubmit(onSubmit)();
  };

  const isGenerating = generateMutation.isPending;

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Prospect Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Sarah" className="h-9" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Johnson" className="h-9" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" className="h-9" {...field} data-testid="input-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Title</FormLabel>
                      <FormControl>
                        <Input placeholder="VP of Sales" className="h-9" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="sarah@acme.com" 
                          className="h-9"
                          {...field} 
                          data-testid="input-email" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="linkedin.com/in/sarah" 
                          className="h-9"
                          {...field} 
                          data-testid="input-linkedin" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Tone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" data-testid="select-tone">
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="hyper-personal">Hyper-Personal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Length</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" data-testid="select-length">
                            <SelectValue placeholder="Select length" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="short">Short</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Context (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any talking points or context..."
                        className="resize-none min-h-[80px]"
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isGenerating} className="w-full" data-testid="button-generate">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Email
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {generatedEmail && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-lg font-medium">Generated Email</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  data-testid="button-regenerate"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  data-testid="button-copy"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  data-testid="button-send"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <div className="text-sm font-medium" data-testid="text-generated-subject">
                {generatedEmail.subject}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Body</Label>
              <div 
                className="p-4 rounded-md bg-secondary/50 font-mono text-sm whitespace-pre-wrap leading-relaxed"
                data-testid="text-generated-body"
              >
                {generatedEmail.body}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Enter your verified SendGrid sender email to send this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="from-email">From (your email)</Label>
              <Input
                id="from-email"
                type="email"
                placeholder="you@yourcompany.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                data-testid="input-sender-email"
              />
              <p className="text-xs text-muted-foreground">
                This must be a verified sender in your SendGrid account
              </p>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <div className="text-sm text-muted-foreground">
                {form.getValues("email")}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <div className="text-sm text-muted-foreground truncate">
                {generatedEmail?.subject}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSendDialog(false)}
              data-testid="button-cancel-send"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={!senderEmail || sendMutation.isPending}
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
