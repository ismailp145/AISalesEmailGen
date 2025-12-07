import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Render the app - ClerkProvider wraps when key is available
const root = createRoot(document.getElementById("root")!);

if (PUBLISHABLE_KEY) {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/sign-in">
        <App />
      </ClerkProvider>
    </StrictMode>
  );
} else {
  // Prevent app from loading if Clerk is not configured
  console.error("Clerk: Missing VITE_CLERK_PUBLISHABLE_KEY - authentication is required but not configured.");
  root.render(
    <StrictMode>
      <div className="text-red-500 text-center mt-8">
        <h1>Authentication Error</h1>
        <p>Clerk is not configured. Please set the <code>VITE_CLERK_PUBLISHABLE_KEY</code> environment variable.</p>
      </div>
    </StrictMode>
  );
}
