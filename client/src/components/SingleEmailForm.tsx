import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useToast } from "@/hooks/use-toast";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [copied, setCopied] = useState(false);
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

  const onSubmit = async (data: FormData) => {
    setIsGenerating(true);
    // todo: remove mock functionality - replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const mockEmail: GeneratedEmail = {
      subject: `Quick question about ${data.company}'s growth strategy`,
      body: `Hi ${data.firstName},

Noticed you recently joined ${data.company} as ${data.title} - congratulations on the new role! With the industry shifting toward AI-powered solutions, I imagine streamlining your team's outreach is high on your priority list.

Many ${data.title}s in your position find that their team spends 60% of their time on manual research and personalization. That's time that could be spent closing deals.

We help sales teams like yours generate highly personalized outreach at scale, cutting research time by 80% while improving response rates.

Would you be open to a quick 15-minute call this week to explore if this could help ${data.company}? I have availability Tuesday at 2pm or Thursday at 10am.

Best regards,
Alex${data.notes ? `\n\nP.S. Regarding "${data.notes}" - I'd love to discuss this further.` : ""}`,
    };
    
    setGeneratedEmail(mockEmail);
    setIsGenerating(false);
    toast({
      title: "Email generated",
      description: "Your Basho email is ready to review.",
    });
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

  const handleSend = async () => {
    setIsSending(true);
    // todo: remove mock functionality - replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSending(false);
    toast({
      title: "Email sent",
      description: `Sent to ${form.getValues("email")}`,
    });
  };

  const handleRegenerate = () => {
    form.handleSubmit(onSubmit)();
  };

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
                  disabled={isSending}
                  data-testid="button-send"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </>
                  )}
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
    </div>
  );
}
