import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Get API URL from environment variable or default to relative paths (for local dev)
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Token provider for Clerk authentication.
 * This allows us to inject the Clerk session token into API requests
 * for cross-origin authentication (frontend on Vercel, backend on Railway).
 */
let getAuthToken: (() => Promise<string | null>) | null = null;

/**
 * Set the auth token provider function. This should be called from a React
 * component that has access to Clerk's useAuth hook.
 * 
 * Returns a cleanup function that will clear the token provider when called.
 * This is useful for React effects:
 *   useEffect(() => {
 *     const cleanup = setAuthTokenProvider(getToken);
 *     return cleanup;
 *   }, [getToken]);
 */
export function setAuthTokenProvider(
  provider: () => Promise<string | null>,
): () => void {
  getAuthToken = provider;

  // Return a cleanup function to avoid holding stale providers
  return () => {
    // Only clear if this provider is still the active one
    if (getAuthToken === provider) {
      getAuthToken = null;
    }
  };
}

/**
 * Get auth headers for API requests.
 * Returns Authorization header with Bearer token if available.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!getAuthToken) {
    return {};
  }
  
  try {
    const token = await getAuthToken();
    if (token) {
      return { "Authorization": `Bearer ${token}` };
    }
  } catch (error) {
    console.warn("[Auth] Failed to get auth token:", error);
  }
  
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Prepend API_URL if it's set (production) or use relative path (local dev)
  const fullUrl = API_URL ? `${API_URL}${url}` : url;
  
  // Get auth headers for cross-origin Clerk authentication
  const authHeaders = await getAuthHeaders();
  
  const res = await fetch(fullUrl, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Prepend API_URL if it's set (production) or use relative path (local dev)
    const fullUrl = API_URL 
      ? `${API_URL}${queryKey.join("/")}`
      : queryKey.join("/");
    
    // Get auth headers for cross-origin Clerk authentication
    const authHeaders = await getAuthHeaders();
      
    const res = await fetch(fullUrl, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
