import { SingleEmailForm } from "@/components/SingleEmailForm";

export default function SingleEmailPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-medium tracking-tight">Single Email</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a personalized Basho-style email for one prospect
        </p>
      </div>
      <SingleEmailForm />
    </div>
  );
}
