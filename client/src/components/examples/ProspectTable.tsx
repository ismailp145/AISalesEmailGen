import { useState } from "react";
import { ProspectTable, type Prospect } from "../ProspectTable";

// todo: remove mock functionality
const mockProspects: Prospect[] = [
  {
    id: "1",
    firstName: "Sarah",
    lastName: "Johnson",
    title: "VP of Sales",
    company: "Acme Corp",
    email: "sarah@acme.com",
    linkedinUrl: "https://linkedin.com/in/sarahjohnson",
    status: "ready",
    generatedEmail: {
      subject: "Quick question about Acme's Q4 growth",
      body: "Hi Sarah, Noticed you recently expanded your sales team...",
    },
  },
  {
    id: "2",
    firstName: "Michael",
    lastName: "Chen",
    title: "Director of Engineering",
    company: "TechStart Inc",
    email: "mchen@techstart.io",
    status: "generating",
  },
  {
    id: "3",
    firstName: "Emily",
    lastName: "Rodriguez",
    title: "Head of Growth",
    company: "ScaleUp",
    email: "emily@scaleup.co",
    linkedinUrl: "https://linkedin.com/in/emilyrodriguez",
    status: "pending",
  },
  {
    id: "4",
    firstName: "James",
    lastName: "Wilson",
    title: "CTO",
    company: "DataFlow",
    email: "jwilson@dataflow.com",
    status: "sent",
    generatedEmail: {
      subject: "DataFlow's infrastructure scaling",
      body: "Hi James, Saw your recent blog post about microservices...",
    },
  },
  {
    id: "5",
    firstName: "Lisa",
    lastName: "Park",
    title: "Sales Manager",
    company: "CloudNine",
    email: "lpark@cloudnine.io",
    status: "error",
  },
];

export default function ProspectTableExample() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  return (
    <div className="w-full">
      <ProspectTable
        prospects={mockProspects}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onViewEmail={(p) => console.log("View email for:", p.firstName)}
      />
    </div>
  );
}
