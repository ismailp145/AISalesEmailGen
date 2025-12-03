import { StatusBadge } from "../StatusBadge";

export default function StatusBadgeExample() {
  return (
    <div className="flex flex-wrap gap-3 p-4">
      <StatusBadge status="pending" />
      <StatusBadge status="generating" />
      <StatusBadge status="ready" />
      <StatusBadge status="sent" />
      <StatusBadge status="error" />
    </div>
  );
}
