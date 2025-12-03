import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Play, Pause, Trash2, Users, Mail, Clock, Calendar, MoreVertical, Edit, Archive } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { SequenceRecord, SequenceWithSteps, SequenceStepApi, ProspectRecord } from "@shared/schema";

type SequenceStatus = "draft" | "active" | "paused" | "archived";

const statusColors: Record<SequenceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/20 text-primary",
  paused: "bg-muted text-muted-foreground border border-primary/30",
  archived: "bg-muted text-muted-foreground opacity-60",
};

const statusLabels: Record<SequenceStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

function formatDelayDays(days: number): string {
  if (days === 0) return "Immediately";
  if (days === 1) return "Day 1";
  return `Day ${days}`;
}

interface StepEditorProps {
  steps: SequenceStepApi[];
  onChange: (steps: SequenceStepApi[]) => void;
}

function StepEditor({ steps, onChange }: StepEditorProps) {
  const addStep = () => {
    const nextStepNumber = steps.length + 1;
    const defaultDelays = [0, 2, 4, 7, 10];
    const delayDays = defaultDelays[steps.length] ?? steps.length * 3;
    
    onChange([
      ...steps,
      {
        stepNumber: nextStepNumber,
        delayDays,
        sendTimeHour: 9,
        sendTimeMinute: 0,
        isFollowUp: steps.length > 0,
      },
    ]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      stepNumber: i + 1,
    }));
    onChange(newSteps);
  };

  const updateStep = (index: number, updates: Partial<SequenceStepApi>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    onChange(newSteps);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Email Steps</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          data-testid="button-add-step"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Step
        </Button>
      </div>
      
      {steps.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
          No steps yet. Add your first email step to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-md border bg-muted/30"
              data-testid={`step-${index}`}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                {step.stepNumber}
              </div>
              
              <div className="flex-1 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Select
                    value={String(step.delayDays)}
                    onValueChange={(val) => updateStep(index, { delayDays: parseInt(val) })}
                  >
                    <SelectTrigger className="w-28 h-8" data-testid={`select-delay-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Immediately</SelectItem>
                      <SelectItem value="1">Day 1</SelectItem>
                      <SelectItem value="2">Day 2</SelectItem>
                      <SelectItem value="3">Day 3</SelectItem>
                      <SelectItem value="4">Day 4</SelectItem>
                      <SelectItem value="5">Day 5</SelectItem>
                      <SelectItem value="7">Day 7</SelectItem>
                      <SelectItem value="10">Day 10</SelectItem>
                      <SelectItem value="14">Day 14</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Select
                    value={String(step.sendTimeHour)}
                    onValueChange={(val) => updateStep(index, { sendTimeHour: parseInt(val) })}
                  >
                    <SelectTrigger className="w-20 h-8" data-testid={`select-time-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 7).map((hour) => (
                        <SelectItem key={hour} value={String(hour)}>
                          {hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {step.isFollowUp && (
                  <Badge variant="secondary" className="text-xs">
                    Follow-up
                  </Badge>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeStep(index)}
                className="text-muted-foreground hover:text-destructive"
                data-testid={`button-remove-step-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SequencesPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<SequenceWithSteps | null>(null);
  const [selectedProspects, setSelectedProspects] = useState<number[]>([]);
  
  // Form state for creating sequence
  const [newSequence, setNewSequence] = useState({
    name: "",
    description: "",
    tone: "professional" as "casual" | "professional" | "hyper-personal",
    length: "medium" as "short" | "medium",
    steps: [] as SequenceStepApi[],
  });
  
  // Form state for editing sequence
  const [editSequence, setEditSequence] = useState({
    name: "",
    description: "",
    tone: "professional" as "casual" | "professional" | "hyper-personal",
    length: "medium" as "short" | "medium",
    steps: [] as SequenceStepApi[],
  });

  // Fetch sequences
  const { data: sequences = [], isLoading } = useQuery<SequenceRecord[]>({
    queryKey: ["/api/sequences"],
  });

  // Fetch prospects for enrollment
  const { data: prospects = [] } = useQuery<ProspectRecord[]>({
    queryKey: ["/api/prospects"],
  });

  // Create sequence mutation
  const createSequenceMutation = useMutation({
    mutationFn: async (data: typeof newSequence) => {
      const res = await apiRequest("POST", "/api/sequences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Sequence created",
        description: "Your email sequence has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create sequence",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update sequence mutation
  const updateSequenceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof editSequence }) => {
      const res = await apiRequest("PATCH", `/api/sequences/${id}`, data);
      return res.json() as Promise<SequenceWithSteps>;
    },
    onSuccess: (updatedSequence, variables) => {
      // Invalidate both the list and the detail cache
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sequences", variables.id] });
      // Update local state with the returned data
      setSelectedSequence(updatedSequence);
      setIsEditDialogOpen(false);
      toast({
        title: "Sequence updated",
        description: "Your email sequence has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update sequence",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update sequence status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: SequenceStatus }) => {
      const res = await apiRequest("PATCH", `/api/sequences/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({ title: "Sequence updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update sequence",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete sequence mutation
  const deleteSequenceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/sequences/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({ title: "Sequence deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete sequence",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Enroll prospects mutation
  const enrollMutation = useMutation({
    mutationFn: async ({ sequenceId, prospectIds }: { sequenceId: number; prospectIds: number[] }) => {
      const res = await apiRequest("POST", `/api/sequences/${sequenceId}/enroll`, { prospectIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      setIsEnrollDialogOpen(false);
      setSelectedSequence(null);
      setSelectedProspects([]);
      toast({
        title: "Prospects enrolled",
        description: "Selected prospects have been enrolled in the sequence.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to enroll prospects",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNewSequence({
      name: "",
      description: "",
      tone: "professional",
      length: "medium",
      steps: [],
    });
  };

  const handleCreateSequence = () => {
    if (!newSequence.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your sequence.",
        variant: "destructive",
      });
      return;
    }
    if (newSequence.steps.length === 0) {
      toast({
        title: "Steps required",
        description: "Please add at least one email step.",
        variant: "destructive",
      });
      return;
    }
    createSequenceMutation.mutate(newSequence);
  };

  const handleEnroll = () => {
    if (!selectedSequence || selectedProspects.length === 0) return;
    enrollMutation.mutate({
      sequenceId: selectedSequence.id,
      prospectIds: selectedProspects,
    });
  };

  const openEnrollDialog = async (sequence: SequenceRecord) => {
    try {
      const res = await apiRequest("GET", `/api/sequences/${sequence.id}`);
      const fullSequence = await res.json() as SequenceWithSteps;
      setSelectedSequence(fullSequence);
      setIsEnrollDialogOpen(true);
    } catch (error) {
      toast({
        title: "Failed to load sequence",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = async (sequence: SequenceRecord) => {
    try {
      const res = await apiRequest("GET", `/api/sequences/${sequence.id}`);
      const fullSequence = await res.json() as SequenceWithSteps;
      setSelectedSequence(fullSequence);
      setEditSequence({
        name: fullSequence.name,
        description: fullSequence.description || "",
        tone: fullSequence.tone as "casual" | "professional" | "hyper-personal",
        length: fullSequence.length as "short" | "medium",
        steps: fullSequence.steps.map((step) => ({
          stepNumber: step.stepNumber,
          delayDays: step.delayDays,
          sendTimeHour: step.sendTimeHour,
          sendTimeMinute: step.sendTimeMinute,
          subjectTemplate: step.subjectTemplate || undefined,
          bodyTemplate: step.bodyTemplate || undefined,
          isFollowUp: step.isFollowUp,
        })),
      });
      setIsEditDialogOpen(true);
    } catch (error) {
      toast({
        title: "Failed to load sequence",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSequence = () => {
    if (!selectedSequence) return;
    if (!editSequence.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your sequence.",
        variant: "destructive",
      });
      return;
    }
    if (editSequence.steps.length === 0) {
      toast({
        title: "Steps required",
        description: "Please add at least one email step.",
        variant: "destructive",
      });
      return;
    }
    updateSequenceMutation.mutate({ id: selectedSequence.id, data: editSequence });
  };

  const toggleProspect = (prospectId: number) => {
    setSelectedProspects((prev) =>
      prev.includes(prospectId)
        ? prev.filter((id) => id !== prospectId)
        : [...prev, prospectId]
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Email Sequences
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create automated multi-step email campaigns with scheduled follow-ups
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-sequence">
          <Plus className="w-4 h-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-1">No sequences yet</h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-4">
              Create your first email sequence to automate follow-up emails and increase response rates.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-sequence">
              <Plus className="w-4 h-4 mr-2" />
              Create Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sequences.map((sequence) => (
            <Card key={sequence.id} className="hover-elevate" data-testid={`card-sequence-${sequence.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{sequence.name}</CardTitle>
                    {sequence.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {sequence.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge className={statusColors[sequence.status as SequenceStatus]}>
                    {statusLabels[sequence.status as SequenceStatus]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{sequence.totalEnrolled} enrolled</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>{sequence.totalReplied} replied</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {sequence.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => updateStatusMutation.mutate({ id: sequence.id, status: "active" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-activate-${sequence.id}`}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Activate
                    </Button>
                  )}
                  {sequence.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: sequence.id, status: "paused" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-pause-${sequence.id}`}
                    >
                      <Pause className="w-3 h-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {sequence.status === "paused" && (
                    <Button
                      size="sm"
                      onClick={() => updateStatusMutation.mutate({ id: sequence.id, status: "active" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-resume-${sequence.id}`}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Resume
                    </Button>
                  )}
                  
                  {sequence.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEnrollDialog(sequence)}
                      data-testid={`button-enroll-${sequence.id}`}
                    >
                      <Users className="w-3 h-3 mr-1" />
                      Enroll
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-menu-${sequence.id}`}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => openEditDialog(sequence)}
                        data-testid={`button-edit-${sequence.id}`}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateStatusMutation.mutate({ id: sequence.id, status: "archived" })}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteSequenceMutation.mutate(sequence.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Sequence Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Email Sequence</DialogTitle>
            <DialogDescription>
              Set up an automated email sequence with scheduled follow-ups.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name</Label>
              <Input
                id="name"
                placeholder="e.g., VP Sales Outreach"
                value={newSequence.name}
                onChange={(e) => setNewSequence({ ...newSequence, name: e.target.value })}
                data-testid="input-sequence-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this sequence..."
                value={newSequence.description}
                onChange={(e) => setNewSequence({ ...newSequence, description: e.target.value })}
                rows={2}
                data-testid="input-sequence-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Tone</Label>
                <Select
                  value={newSequence.tone}
                  onValueChange={(val: "casual" | "professional" | "hyper-personal") =>
                    setNewSequence({ ...newSequence, tone: val })
                  }
                >
                  <SelectTrigger data-testid="select-tone">
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
                <Label>Email Length</Label>
                <Select
                  value={newSequence.length}
                  onValueChange={(val: "short" | "medium") =>
                    setNewSequence({ ...newSequence, length: val })
                  }
                >
                  <SelectTrigger data-testid="select-length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (3-4 sentences)</SelectItem>
                    <SelectItem value="medium">Medium (4-6 sentences)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <StepEditor
              steps={newSequence.steps}
              onChange={(steps) => setNewSequence({ ...newSequence, steps })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSequence}
              disabled={createSequenceMutation.isPending}
              data-testid="button-save-sequence"
            >
              {createSequenceMutation.isPending ? "Creating..." : "Create Sequence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sequence Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sequence</DialogTitle>
            <DialogDescription>
              Update your email sequence settings and steps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Sequence Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., VP Sales Outreach"
                value={editSequence.name}
                onChange={(e) => setEditSequence({ ...editSequence, name: e.target.value })}
                data-testid="input-edit-sequence-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                placeholder="Brief description of this sequence..."
                value={editSequence.description}
                onChange={(e) => setEditSequence({ ...editSequence, description: e.target.value })}
                rows={2}
                data-testid="input-edit-sequence-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Tone</Label>
                <Select
                  value={editSequence.tone}
                  onValueChange={(val: "casual" | "professional" | "hyper-personal") =>
                    setEditSequence({ ...editSequence, tone: val })
                  }
                >
                  <SelectTrigger data-testid="select-edit-tone">
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
                <Label>Email Length</Label>
                <Select
                  value={editSequence.length}
                  onValueChange={(val: "short" | "medium") =>
                    setEditSequence({ ...editSequence, length: val })
                  }
                >
                  <SelectTrigger data-testid="select-edit-length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (3-4 sentences)</SelectItem>
                    <SelectItem value="medium">Medium (4-6 sentences)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <StepEditor
              steps={editSequence.steps}
              onChange={(steps) => setEditSequence({ ...editSequence, steps })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSequence}
              disabled={updateSequenceMutation.isPending}
              data-testid="button-update-sequence"
            >
              {updateSequenceMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll Prospects Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enroll Prospects</DialogTitle>
            <DialogDescription>
              Select prospects to enroll in "{selectedSequence?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {prospects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No prospects available.</p>
                <p className="text-sm">Sync contacts from HubSpot or import via CSV first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {prospects.map((prospect) => (
                  <div
                    key={prospect.id}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedProspects.includes(prospect.id)
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleProspect(prospect.id)}
                    data-testid={`prospect-${prospect.id}`}
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center ${
                        selectedProspects.includes(prospect.id)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}
                    >
                      {selectedProspects.includes(prospect.id) && (
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6l3 3 5-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {prospect.firstName} {prospect.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {prospect.title} at {prospect.company}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {selectedProspects.length} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleEnroll}
                  disabled={selectedProspects.length === 0 || enrollMutation.isPending}
                  data-testid="button-confirm-enroll"
                >
                  {enrollMutation.isPending ? "Enrolling..." : "Enroll Prospects"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
