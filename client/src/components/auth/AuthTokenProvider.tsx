import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setAuthTokenProvider } from "@/lib/queryClient";

/**
 * Context to track whether auth is fully initialized and ready for API calls.
 * This prevents race conditions where React Query fires requests before
 * the Clerk token provider is set up.
 */
const AuthReadyContext = createContext<boolean>(false);

/**
 * Hook to check if authentication is ready for API calls.
 * Use this to conditionally enable queries that require authentication.
 * 
 * @example
 * const isAuthReady = useIsAuthReady();
 * const { data } = useQuery({
 *   queryKey: ["/api/subscription"],
 *   enabled: isAuthReady,
 * });
 */
export function useIsAuthReady() {
  return useContext(AuthReadyContext);
}

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
  const [isAuthReady, setIsAuthReady] = useState(false);

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

    // Mark auth as ready AFTER setting up the token provider
    // This ensures queries won't fire until the provider is in place
    setIsAuthReady(true);

    // Clean up the token provider when the component unmounts
    // or when getToken changes to avoid holding stale references
    return () => {
      cleanup();
      setIsAuthReady(false);
    };
  }, [getToken, isLoaded]);

  return (
    <AuthReadyContext.Provider value={isAuthReady}>
      {children}
    </AuthReadyContext.Provider>
  );
}
