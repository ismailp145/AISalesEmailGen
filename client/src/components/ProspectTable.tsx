import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { StatusBadge, type ProspectStatus } from "./StatusBadge";
import { Eye, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  linkedinUrl?: string;
  notes?: string;
  status: ProspectStatus;
  generatedEmail?: {
    subject: string;
    body: string;
  };
}

interface ProspectTableProps {
  prospects: Prospect[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onViewEmail: (prospect: Prospect) => void;
}

export function ProspectTable({
  prospects,
  selectedIds,
  onSelectionChange,
  onViewEmail,
}: ProspectTableProps) {
  const allSelected = prospects.length > 0 && prospects.every((p) => selectedIds.has(p.id));
  const someSelected = prospects.some((p) => selectedIds.has(p.id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(prospects.map((p) => p.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const getPreview = (prospect: Prospect) => {
    if (!prospect.generatedEmail) return null;
    const preview = prospect.generatedEmail.body.slice(0, 60);
    return preview + (prospect.generatedEmail.body.length > 60 ? "..." : "");
  };

  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30 border-border/50">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = someSelected;
                }}
                onCheckedChange={handleSelectAll}
                data-testid="checkbox-select-all"
              />
            </TableHead>
            <TableHead className="text-xs font-medium">Name</TableHead>
            <TableHead className="text-xs font-medium hidden md:table-cell">Title</TableHead>
            <TableHead className="text-xs font-medium hidden lg:table-cell">Company</TableHead>
            <TableHead className="text-xs font-medium">Status</TableHead>
            <TableHead className="text-xs font-medium hidden md:table-cell">Preview</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospects.map((prospect) => (
            <TableRow
              key={prospect.id}
              className={cn(
                "border-border/50",
                selectedIds.has(prospect.id) && "bg-primary/5"
              )}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(prospect.id)}
                  onCheckedChange={() => handleSelectOne(prospect.id)}
                  data-testid={`checkbox-row-${prospect.id}`}
                />
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium">
                  {prospect.firstName} {prospect.lastName}
                </div>
                <div className="text-xs text-muted-foreground md:hidden">
                  {prospect.title}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {prospect.title}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                {prospect.company}
              </TableCell>
              <TableCell>
                <StatusBadge status={prospect.status} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {prospect.generatedEmail ? (
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {getPreview(prospect)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-0.5">
                  {prospect.generatedEmail && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => onViewEmail(prospect)}
                      data-testid={`button-view-email-${prospect.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {prospect.linkedinUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      asChild
                    >
                      <a
                        href={prospect.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-linkedin-${prospect.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {prospects.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                No prospects yet. Upload a CSV to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
