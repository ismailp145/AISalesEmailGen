import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <SignUp 
        routing="path" 
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "hsl(0, 0%, 90%)",
            colorBackground: "hsl(220, 8%, 8%)",
            colorInputBackground: "hsl(220, 6%, 12%)",
            colorInputText: "hsl(0, 0%, 95%)",
            colorText: "hsl(0, 0%, 95%)",
            colorTextSecondary: "hsl(220, 5%, 60%)",
            colorDanger: "hsl(0, 72%, 51%)",
            borderRadius: "0.5rem",
          },
          elements: {
            rootBox: "mx-auto",
            card: "bg-card border border-border shadow-xl rounded-xl",
            headerTitle: "text-foreground font-semibold",
            headerSubtitle: "text-muted-foreground",
            socialButtonsBlockButton: "bg-secondary border border-border text-foreground hover:bg-secondary/80",
            socialButtonsBlockButtonText: "text-foreground font-medium",
            dividerLine: "bg-border",
            dividerText: "text-muted-foreground",
            formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
            formFieldLabel: "text-foreground font-medium",
            formFieldInput: "bg-input border-border text-foreground placeholder:text-muted-foreground",
            formFieldInputShowPasswordButton: "text-muted-foreground hover:text-foreground",
            footerActionLink: "text-primary hover:text-primary/80 font-medium",
            footerActionText: "text-muted-foreground",
            identityPreviewText: "text-foreground",
            identityPreviewEditButton: "text-primary hover:text-primary/80",
            formResendCodeLink: "text-primary hover:text-primary/80",
            otpCodeFieldInput: "bg-input border-border text-foreground",
            alertText: "text-foreground",
            formFieldWarningText: "text-yellow-500",
            formFieldErrorText: "text-destructive",
          },
        }}
      />
    </div>
  );
}
