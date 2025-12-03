import { SingleEmailForm } from "@/components/SingleEmailForm";

export default function SingleEmailPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Single Email</h1>
        <p className="text-muted-foreground mt-1">
          Generate a personalized Basho-style email for one prospect
        </p>
      </div>
      <SingleEmailForm />
    </div>
  );
}
