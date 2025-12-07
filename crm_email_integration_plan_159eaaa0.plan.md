---
name: CRM Email Integration Plan
overview: Implement Salesforce integration, Gmail/Outlook OAuth email sending, database persistence for generated emails, enhanced LinkedIn content input, and migrate to OpenRouter with Vercel AI SDK.
todos:
  - id: openrouter-sdk
    content: Install Vercel AI SDK and configure OpenRouter as provider in server/openai.ts
    status: pending
  - id: salesforce-service
    content: Create server/salesforce.ts with OAuth flow, contact sync, and activity logging
    status: pending
  - id: salesforce-routes
    content: Add Salesforce API routes to server/routes.ts
    status: pending
  - id: gmail-service
    content: Create server/gmail.ts with Google OAuth and Gmail API email sending
    status: pending
  - id: gmail-routes
    content: Add Gmail API routes to server/routes.ts
    status: pending
  - id: outlook-service
    content: Create server/outlook.ts with Microsoft OAuth and Graph API email sending
    status: pending
  - id: outlook-routes
    content: Add Outlook API routes to server/routes.ts
    status: pending
  - id: email-persistence
    content: Update routes to save generated emails to emailActivities table
    status: pending
  - id: email-history-page
    content: Create EmailHistoryPage.tsx to display saved emails from database
    status: pending
  - id: linkedin-input
    content: Add LinkedIn profile paste field to SingleEmailForm and update AI prompt
    status: pending
  - id: bulk-import-verify
    content: Test and fix CSV bulk import functionality
    status: pending
  - id: integrations-ui
    content: Update IntegrationsPage.tsx with Salesforce, Gmail, Outlook sections
    status: pending
  - id: clerk-frontend
    content: Wire up ProtectedRoute in App.tsx and add UserButton to TopBar
    status: pending
  - id: clerk-backend
    content: Apply clerkAuthMiddleware and requireAuthentication to Express routes
    status: pending
  - id: clerk-db-schema
    content: Add userId column to userProfiles, prospects, sequences, crmConnections tables
    status: pending
  - id: clerk-storage
    content: Update storage.ts methods to scope all data by userId
    status: pending
---

# AI Sales Email Generator - Integration Enhancement Plan

## 1. Switch to OpenRouter + Vercel AI SDK

Replace the current OpenAI SDK with Vercel AI SDK configured for OpenRouter.

- Install `ai` (Vercel AI SDK) and `@ai-sdk/openai` packages
- Update `server/openai.ts` to use Vercel AI SDK with OpenRouter base URL
- Configure environment variable `OPENROUTER_API_KEY`
- Update email generation and trigger detection functions to use the new SDK
```typescript
// server/openai.ts - new approach
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
```


## 2. Salesforce Integration

Create a Salesforce service mirroring the HubSpot pattern using Salesforce REST API.

**Files to create:**

- `server/salesforce.ts` - Salesforce service class

**Features:**

- OAuth2 authentication flow (authorization code grant)
- Fetch contacts from Salesforce
- Search contacts
- Log email activities as Tasks
- Token refresh handling

**New API routes in `server/routes.ts`:**

- `GET /api/crm/salesforce/auth` - Initiate OAuth
- `GET /api/crm/salesforce/callback` - OAuth callback
- `POST /api/crm/salesforce/disconnect`
- `POST /api/crm/salesforce/sync`
- `POST /api/crm/salesforce/log-activity`

## 3. Gmail Integration (OAuth)

Implement Gmail sending via Google OAuth2 and Gmail API.

**Files to create:**

- `server/gmail.ts` - Gmail service class

**Features:**

- OAuth2 flow for user authentication
- Send emails via Gmail API
- Store OAuth tokens in `crmConnections` table (provider: 'gmail')

**New API routes:**

- `GET /api/email/gmail/auth` - Initiate OAuth
- `GET /api/email/gmail/callback` - OAuth callback
- `POST /api/email/gmail/disconnect`
- `POST /api/email/gmail/send` - Send email via connected Gmail

## 4. Outlook Integration (OAuth)

Implement Outlook sending via Microsoft Graph API.

**Files to create:**

- `server/outlook.ts` - Outlook/Microsoft Graph service class

**Features:**

- OAuth2 flow with Microsoft identity platform
- Send emails via Microsoft Graph API
- Store OAuth tokens in `crmConnections` table (provider: 'outlook')

**New API routes:**

- `GET /api/email/outlook/auth` - Initiate OAuth
- `GET /api/email/outlook/callback` - OAuth callback
- `POST /api/email/outlook/disconnect`
- `POST /api/email/outlook/send` - Send email via connected Outlook

## 5. Email Persistence and History UI

Save generated emails to the database and display them in a new UI section.

**Database changes:**

- Enhance `emailActivities` table usage (already exists in schema)
- Add `emailProvider` field to track which service sent the email

**Backend changes in `server/routes.ts`:**

- Update `/api/generate-email` to save generated emails to database
- Add `GET /api/emails` - Fetch email history
- Add `GET /api/emails/:id` - Fetch single email details
- Add `PATCH /api/emails/:id` - Update email status

**Frontend changes:**

- Create `client/src/pages/EmailHistoryPage.tsx` - Display saved emails
- Add route to sidebar navigation
- Show email status (generated, sent, opened, replied)

## 6. Enhanced LinkedIn Content Input

Add a dedicated field for pasting LinkedIn profile content.

**Frontend changes in `client/src/components/SingleEmailForm.tsx`:**

- Add collapsible "LinkedIn Profile Data" section
- Add textarea for pasting LinkedIn profile content (headline, about, experience)
- Parse pasted content and include in AI prompt for better personalization

**Backend changes:**

- Update email generation prompt to better utilize pasted LinkedIn content
- Add field to prospect schema for LinkedIn scraped data

## 7. Bulk Import Verification and Enhancement

Review and fix CSV bulk import functionality.

**Verification tasks:**

- Test CSV parsing with various formats
- Ensure all required fields are validated
- Add better error handling and user feedback
- Support additional CSV columns (LinkedIn data field)

**Enhancements:**

- Add progress indicator during bulk generation
- Show detailed error messages per prospect
- Allow re-generating failed prospects

## 8. Update Integrations Page UI

Update `client/src/pages/IntegrationsPage.tsx` to include all new integrations.

**Add sections for:**

- Salesforce connection (OAuth flow)
- Gmail connection (OAuth flow)
- Outlook connection (OAuth flow)
- SendGrid configuration status

## 9. Clerk Authentication Implementation

Implement Clerk following the official React (Vite) quickstart: https://clerk.com/docs/quickstarts/react

### Frontend Changes

**Update `client/src/main.tsx`:**

- Move `<ClerkProvider>` directly into `main.tsx` (not in a wrapper component)
- Throw error if `VITE_CLERK_PUBLISHABLE_KEY` is missing
- Add `afterSignOutUrl="/"` prop
```tsx
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>
);
```


**Delete `client/src/components/auth/ClerkProviderWrapper.tsx`** - no longer needed

**Update `client/src/App.tsx`:**

- Use `<SignedIn>` and `<SignedOut>` components to control access
- Remove import of `ClerkProviderWrapper`
```tsx
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";

function App() {
  return (
    <>
      <SignedOut>
        {/* Show sign-in/sign-up UI */}
        <SignInButton />
        <SignUpButton />
      </SignedOut>
      <SignedIn>
        {/* Show protected app content */}
        <AppLayout>
          <Router />
        </AppLayout>
      </SignedIn>
    </>
  );
}
```


**Update `client/src/components/TopBar.tsx`:**

- Import and use `<UserButton />` from `@clerk/clerk-react`
```tsx
import { UserButton } from "@clerk/clerk-react";

// In the TopBar component
<UserButton />
```


**Delete `client/src/components/auth/UserButton.tsx`** - use Clerk's built-in component directly

### Backend Changes

**Update `server/index.ts`:**

- Apply `clerkAuthMiddleware` globally to the Express app

**Update `server/routes.ts`:**

- Apply `requireAuthentication` middleware to all `/api/*` routes
- Use `getCurrentUserId(req)` to get the authenticated user's ID

### Database Changes

**Update `shared/schema.ts`:**

- Add `userId` column to `userProfiles`, `prospects`, `sequences`, `crmConnections` tables

**Update `server/storage.ts`:**

- Modify all storage methods to accept and filter by `userId`
- Scope user profiles, prospects, sequences, and CRM connections per user

### Environment Variables (in `.env.local`)

```
VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY
```

## Environment Variables Required

```
# Clerk Auth
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx

# AI
OPENROUTER_API_KEY=your_openrouter_key

# CRM Integrations
HUBSPOT_API_KEY=your_hubspot_key
SALESFORCE_CLIENT_ID=your_sf_client_id
SALESFORCE_CLIENT_SECRET=your_sf_client_secret

# Email Integrations
SENDGRID_API_KEY=your_sendgrid_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
MICROSOFT_CLIENT_ID=your_ms_client_id
MICROSOFT_CLIENT_SECRET=your_ms_client_secret
```