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
  // Render without Clerk if not configured (development/testing)
  console.warn("Clerk: Missing VITE_CLERK_PUBLISHABLE_KEY - authentication disabled");
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
