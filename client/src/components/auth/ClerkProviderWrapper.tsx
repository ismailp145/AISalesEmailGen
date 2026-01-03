import { ClerkProvider } from "@clerk/clerk-react";
import { AuthTokenProvider } from "./AuthTokenProvider";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface ClerkProviderWrapperProps {
  children: React.ReactNode;
}

export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  if (!PUBLISHABLE_KEY) {
    console.warn("Clerk: Missing VITE_CLERK_PUBLISHABLE_KEY - authentication disabled");
    return <>{children}</>;
  }

  // For cross-origin deployments (frontend on Vercel, backend on Railway),
  // we need to configure Clerk to work with Bearer tokens instead of cookies.
  // The AuthTokenProvider hooks up Clerk's session token to the queryClient
  // so all API requests include the Authorization header.
  return (
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      <AuthTokenProvider>
        {children}
      </AuthTokenProvider>
    </ClerkProvider>
  );
}
