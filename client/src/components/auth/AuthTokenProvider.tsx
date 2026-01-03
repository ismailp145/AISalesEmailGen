import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setAuthTokenProvider } from "@/lib/queryClient";

/**
 * AuthTokenProvider hooks up Clerk's session token to the queryClient.
 * This enables cross-origin API requests with proper authentication.
 * 
 * For deployments where frontend (Vercel) and backend (Railway) are on
 * different domains, we can't rely on cookies. Instead, we send the
 * Clerk session token as a Bearer token in the Authorization header.
 */
export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    // Set up the token provider for the queryClient
    const cleanup = setAuthTokenProvider(async () => {
      try {
        // Get the session token from Clerk
        const token = await getToken();
        return token;
      } catch (error) {
        console.warn("[AuthTokenProvider] Failed to get token:", error);
        return null;
      }
    });

    // Clean up the token provider when the component unmounts
    // or when getToken changes to avoid holding stale references
    return cleanup;
  }, [getToken, isLoaded]);

  return <>{children}</>;
}

