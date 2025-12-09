import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ClerkProviderWrapper } from "./components/auth/ClerkProviderWrapper";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const authMissing = !PUBLISHABLE_KEY;

const root = createRoot(document.getElementById("root")!);

if (authMissing) {
  console.warn("Clerk: Missing VITE_CLERK_PUBLISHABLE_KEY - running without authentication in development.");
}

root.render(
  <StrictMode>
    <ClerkProviderWrapper>
      {authMissing && (
        <div className="bg-amber-100 text-amber-800 px-4 py-3 text-sm text-center">
          Authentication is disabled (no Clerk publishable key). This mode is for local development only.
        </div>
      )}
      <App />
    </ClerkProviderWrapper>
  </StrictMode>
);
