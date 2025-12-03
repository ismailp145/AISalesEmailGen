import { useState } from "react";
import { EmailPreviewModal } from "../EmailPreviewModal";
import { Button } from "@/components/ui/button";

export default function EmailPreviewModalExample() {
  const [open, setOpen] = useState(true);

  // todo: remove mock functionality
  const mockEmail = {
    subject: "Quick question about Acme Corp's Q4 expansion",
    body: `Hi Sarah,

Noticed you just got promoted to VP of Sales at Acme Corp - congratulations! With your team growing from 15 to 40 reps this quarter, I imagine scaling your outbound operations while maintaining quality is top of mind.

Most sales leaders in your position struggle with rep ramp time eating into quota attainment. What worked for 15 reps often breaks at 40.

We help teams like yours cut ramp time by 40% through AI-assisted coaching that gives every rep a personal sales trainer.

Would you be open to a quick 15-minute call Tuesday at 2pm or Wednesday at 10am to explore if this could help your expansion?

Best,
Alex`,
  };

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Email Preview</Button>
      <EmailPreviewModal
        open={open}
        onOpenChange={setOpen}
        email={mockEmail}
        prospectName="Sarah Johnson"
        onSave={(email) => console.log("Saved:", email)}
        onRegenerate={() => console.log("Regenerating...")}
      />
    </div>
  );
}
