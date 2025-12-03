import { useState, useCallback } from "react";
import { Sparkles, Send, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/FileDropzone";
import { ProspectTable, type Prospect } from "@/components/ProspectTable";
import { EmailPreviewModal } from "@/components/EmailPreviewModal";
import { useToast } from "@/hooks/use-toast";

// todo: remove mock functionality - CSV parsing will use papaparse
function parseCSV(content: string): Omit<Prospect, "id" | "status">[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
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

export default function BulkCampaignsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
      description: `${newProspects.length} prospects loaded successfully.`,
    });
  }, [toast]);

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    
    // todo: remove mock functionality - replace with actual API call
    for (let i = 0; i < prospects.length; i++) {
      setProspects((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, status: "generating" as const } : p
        )
      );
      
      await new Promise((r) => setTimeout(r, 800));
      
      setProspects((prev) =>
        prev.map((p, idx) =>
          idx === i
            ? {
                ...p,
                status: "ready" as const,
                generatedEmail: {
                  subject: `Quick question about ${p.company}'s growth`,
                  body: `Hi ${p.firstName},\n\nNoticed you're the ${p.title} at ${p.company}. With rapid changes in your industry, I imagine optimizing your team's productivity is a top priority.\n\nWe help leaders like you achieve 40% better results through AI-powered outreach.\n\nWould you be open to a quick 15-minute call this week? I have availability Tuesday at 2pm or Thursday at 10am.\n\nBest,\nAlex`,
                },
              }
            : p
        )
      );
    }
    
    setIsGenerating(false);
    toast({
      title: "Emails generated",
      description: `Generated emails for ${prospects.length} prospects.`,
    });
  };

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No prospects selected",
        description: "Please select at least one prospect to send emails.",
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
        description: "Selected prospects don't have generated emails yet.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    // todo: remove mock functionality - replace with actual API call
    for (const prospect of readyProspects) {
      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospect.id ? { ...p, status: "sent" as const } : p
        )
      );
      await new Promise((r) => setTimeout(r, 300));
    }
    
    setIsSending(false);
    setSelectedIds(new Set());
    toast({
      title: "Emails sent",
      description: `Successfully sent ${readyProspects.length} emails.`,
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

  const handleRegenerateEmail = async () => {
    if (!selectedProspect) return;
    
    setProspects((prev) =>
      prev.map((p) =>
        p.id === selectedProspect.id ? { ...p, status: "generating" as const } : p
      )
    );
    
    // todo: remove mock functionality
    await new Promise((r) => setTimeout(r, 1500));
    
    const newEmail = {
      subject: `Following up on ${selectedProspect.company}'s initiatives`,
      body: `Hi ${selectedProspect.firstName},\n\nI hope this finds you well! I recently came across ${selectedProspect.company}'s latest announcements and was impressed by your team's momentum.\n\nAs ${selectedProspect.title}, you're likely focused on scaling efficiently. Our platform helps teams achieve more with less effort.\n\nWould you have 15 minutes for a quick chat? I'm free Tuesday at 3pm or Wednesday at 11am.\n\nBest regards,\nAlex`,
    };
    
    setProspects((prev) =>
      prev.map((p) =>
        p.id === selectedProspect.id
          ? { ...p, status: "ready" as const, generatedEmail: newEmail }
          : p
      )
    );
    
    setSelectedProspect((prev) =>
      prev ? { ...prev, generatedEmail: newEmail } : null
    );
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

  const readyCount = prospects.filter((p) => p.status === "ready").length;
  const selectedReadyCount = prospects.filter(
    (p) => selectedIds.has(p.id) && p.status === "ready"
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bulk Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Upload a CSV file to generate emails for multiple prospects at once
          </p>
        </div>
        <Button variant="outline" onClick={downloadSampleCSV} data-testid="button-download-sample">
          <Download className="w-4 h-4 mr-2" />
          Sample CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Prospects</CardTitle>
          <CardDescription>
            Upload a CSV file with your prospect data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropzone onFileSelect={handleFileSelect} />
        </CardContent>
      </Card>

      {prospects.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>
                  Prospects ({prospects.length})
                </CardTitle>
                <CardDescription>
                  {readyCount} emails ready • {selectedIds.size} selected
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={handleGenerateAll}
                  disabled={isGenerating || prospects.every((p) => p.status !== "pending")}
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
                      Generate for All
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSendSelected}
                  disabled={isSending || selectedReadyCount === 0}
                  data-testid="button-send-selected"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Selected ({selectedReadyCount})
                    </>
                  )}
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
        isRegenerating={selectedProspect?.status === "generating"}
      />
    </div>
  );
}
