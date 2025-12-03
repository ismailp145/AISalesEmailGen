import { useState, useCallback } from "react";
import { Sparkles, Send, Loader2, Download } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/FileDropzone";
import { ProspectTable, type Prospect } from "@/components/ProspectTable";
import { EmailPreviewModal } from "@/components/EmailPreviewModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function parseCSV(content: string): Omit<Prospect, "id" | "status">[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  
  return lines.slice(1).filter(line => line.trim()).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    
    return {
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      title: row.title || "",
      company: row.company || "",
      email: row.email || "",
      linkedinUrl: row.linkedin_url || undefined,
      notes: row.notes || undefined,
    };
  });
}

type Tone = "casual" | "professional" | "hyper-personal";
type Length = "short" | "medium";

export default function BulkCampaignsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tone, setTone] = useState<Tone>("professional");
  const [length, setLength] = useState<Length>("medium");
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (file: File) => {
    const content = await file.text();
    const parsed = parseCSV(content);
    
    const newProspects: Prospect[] = parsed.map((p, i) => ({
      ...p,
      id: `prospect-${Date.now()}-${i}`,
      status: "pending" as const,
    }));
    
    setProspects(newProspects);
    toast({
      title: "CSV imported",
      description: `${newProspects.length} prospects loaded.`,
    });
  }, [toast]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const pendingProspects = prospects.filter(p => p.status === "pending");
      
      setProspects(prev => prev.map(p => 
        p.status === "pending" ? { ...p, status: "generating" as const } : p
      ));

      const response = await apiRequest("POST", "/api/generate-emails-bulk", {
        prospects: pendingProspects.map(p => ({
          firstName: p.firstName,
          lastName: p.lastName,
          company: p.company,
          title: p.title,
          email: p.email,
          linkedinUrl: p.linkedinUrl,
          notes: p.notes,
        })),
        tone,
        length,
      });
      
      return response.json() as Promise<Array<{
        prospect: any;
        email?: { subject: string; body: string };
        error?: string;
        status: string;
      }>>;
    },
    onSuccess: (results) => {
      setProspects(prev => {
        const pendingIds = prev.filter(p => p.status === "generating").map(p => p.id);
        return prev.map((p, idx) => {
          const pendingIndex = pendingIds.indexOf(p.id);
          if (pendingIndex === -1) return p;
          
          const result = results[pendingIndex];
          if (!result) return p;
          
          return {
            ...p,
            status: result.email ? "ready" as const : "error" as const,
            generatedEmail: result.email,
            error: result.error,
          };
        });
      });
      
      const successCount = results.filter(r => r.email).length;
      toast({
        title: "Complete",
        description: `Generated ${successCount} of ${results.length} emails.`,
      });
    },
    onError: (error: any) => {
      setProspects(prev => prev.map(p => 
        p.status === "generating" ? { ...p, status: "error" as const } : p
      ));
      toast({
        title: "Generation failed",
        description: error?.message || "Could not generate emails. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateAll = () => {
    generateMutation.mutate();
  };

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No selection",
        description: "Select at least one prospect.",
        variant: "destructive",
      });
      return;
    }

    const readyProspects = prospects.filter(
      (p) => selectedIds.has(p.id) && p.status === "ready"
    );

    if (readyProspects.length === 0) {
      toast({
        title: "No ready emails",
        description: "Selected prospects don't have generated emails.",
        variant: "destructive",
      });
      return;
    }

    setProspects(prev => prev.map(p => 
      selectedIds.has(p.id) && p.status === "ready" 
        ? { ...p, status: "sent" as const } 
        : p
    ));
    
    setSelectedIds(new Set());
    toast({
      title: "Marked as sent",
      description: `${readyProspects.length} emails marked as sent.`,
    });
  };

  const handleViewEmail = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setModalOpen(true);
  };

  const handleSaveEmail = (email: { subject: string; body: string }) => {
    if (!selectedProspect) return;
    setProspects((prev) =>
      prev.map((p) =>
        p.id === selectedProspect.id ? { ...p, generatedEmail: email } : p
      )
    );
  };

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProspect) throw new Error("No prospect selected");
      
      const response = await apiRequest("POST", "/api/generate-email", {
        prospect: {
          firstName: selectedProspect.firstName,
          lastName: selectedProspect.lastName,
          company: selectedProspect.company,
          title: selectedProspect.title,
          email: selectedProspect.email,
          linkedinUrl: selectedProspect.linkedinUrl,
          notes: selectedProspect.notes,
        },
        tone,
        length,
      });
      
      return response.json() as Promise<{ subject: string; body: string }>;
    },
    onSuccess: (email) => {
      if (!selectedProspect) return;
      
      setProspects(prev => prev.map(p => 
        p.id === selectedProspect.id 
          ? { ...p, status: "ready" as const, generatedEmail: email }
          : p
      ));
      
      setSelectedProspect(prev => 
        prev ? { ...prev, generatedEmail: email } : null
      );
    },
    onError: (error: any) => {
      toast({
        title: "Regeneration failed",
        description: error?.message || "Could not regenerate email.",
        variant: "destructive",
      });
    },
  });

  const handleRegenerateEmail = async () => {
    if (!selectedProspect) return;
    
    setProspects(prev => prev.map(p => 
      p.id === selectedProspect.id ? { ...p, status: "generating" as const } : p
    ));
    
    regenerateMutation.mutate();
  };

  const downloadSampleCSV = () => {
    const csv = `first_name,last_name,title,company,email,linkedin_url,notes
Sarah,Johnson,VP of Sales,Acme Corp,sarah@acme.com,https://linkedin.com/in/sarahjohnson,Recently promoted
Michael,Chen,Director of Engineering,TechStart,mchen@techstart.io,,Interested in AI tools
Emily,Rodriguez,Head of Growth,ScaleUp,emily@scaleup.co,https://linkedin.com/in/emilyrodriguez,Met at conference`;
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_prospects.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingCount = prospects.filter(p => p.status === "pending").length;
  const readyCount = prospects.filter((p) => p.status === "ready").length;
  const selectedReadyCount = prospects.filter(
    (p) => selectedIds.has(p.id) && p.status === "ready"
  ).length;

  const isGenerating = generateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Bulk Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV to generate emails for multiple prospects
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadSampleCSV} data-testid="button-download-sample">
          <Download className="w-4 h-4 mr-2" />
          Sample CSV
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Upload Prospects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone onFileSelect={handleFileSelect} />
          
          {prospects.length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                  <SelectTrigger className="h-9" data-testid="select-bulk-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="hyper-personal">Hyper-Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Length</Label>
                <Select value={length} onValueChange={(v) => setLength(v as Length)}>
                  <SelectTrigger className="h-9" data-testid="select-bulk-length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {prospects.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg font-medium">
                  Prospects
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {prospects.length} total · {readyCount} ready · {selectedIds.size} selected
                  </span>
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAll}
                  disabled={isGenerating || pendingCount === 0}
                  data-testid="button-generate-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate All ({pendingCount})
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendSelected}
                  disabled={selectedReadyCount === 0}
                  data-testid="button-send-selected"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Mark Sent ({selectedReadyCount})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProspectTable
              prospects={prospects}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onViewEmail={handleViewEmail}
            />
          </CardContent>
        </Card>
      )}

      <EmailPreviewModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        email={selectedProspect?.generatedEmail || null}
        prospectName={
          selectedProspect
            ? `${selectedProspect.firstName} ${selectedProspect.lastName}`
            : undefined
        }
        onSave={handleSaveEmail}
        onRegenerate={handleRegenerateEmail}
        isRegenerating={regenerateMutation.isPending || selectedProspect?.status === "generating"}
      />
    </div>
  );
}
