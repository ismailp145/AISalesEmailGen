import { useAuth, RedirectToSignIn } from "@clerk/clerk-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If not signed in, redirect to sign-in page
  if (!isSignedIn) {
    return <RedirectToSignIn redirectUrl={window.location.pathname} />;
  }

  // User is signed in, render the protected content
  return <>{children}</>;
}
