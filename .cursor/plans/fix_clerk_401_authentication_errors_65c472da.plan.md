---
name: Fix Clerk 401 Authentication Errors
overview: Fix 401 errors on `/api/subscription` and `/api/profile` routes by ensuring Clerk tokens are properly sent from frontend and extracted by backend middleware. The issue involves CORS configuration, Clerk domain settings, and token extraction.
todos: []
---

# Fix Clerk 401 Authentication Errors

## Problem Analysis

The 401 errors on `/api/subscription` and `/api/profile` indicate that `getAuth(req).userId` is returning `null` in `server/middleware/clerk.ts`. This happens when Clerk Express middleware cannot extract the authentication token from incoming requests.

## Root Causes

1. **Clerk domain mismatch**: Frontend ClerkProvider may not be configured with the correct production domain
2. **Token extraction failure**: Clerk Express middleware isn't reading tokens from Authorization header or cookies
3. **CORS configuration**: May be blocking credentials or Authorization headers
4. **Missing Clerk frontend domain config**: ClerkProvider needs explicit domain configuration for cross-origin requests

## Implementation Plan

### 1. Update ClerkProvider Configuration

**File**: `client/src/components/auth/ClerkProviderWrapper.tsx`

- Add `domain` prop to ClerkProvider pointing to the production domain (`www.bashostudio.com`)
- This ensures Clerk sets cookies with the correct domain scope
- Add `proxyUrl` if needed for development

### 2. Enhance Clerk Express Middleware Configuration

**File**: `server/middleware/clerk.ts`

- Add explicit token source configuration to `clerkMiddleware` options
- Configure `audience` if using JWT tokens
- Add logging to debug token extraction failures
- Ensure middleware reads from both Authorization header and cookies

### 3. Verify CORS Configuration

**File**: `server/middleware/cors.ts`

- Ensure `Authorization` header is explicitly allowed in `allowedHeaders`
- Verify `credentials: true` is set (already present)
- Add logging for blocked CORS requests

### 4. Add Debug Logging

**File**: `server/middleware/clerk.ts`

- Add console logs to track:
- Whether tokens are present in request headers
- What `getAuth(req)` returns
- Token extraction failures

### 5. Check Frontend Request Configuration

**File**: `client/src/lib/queryClient.ts`

- Verify `credentials: "include"` is set (already present)
- Ensure requests include Authorization headers if Clerk provides them
- Check if Clerk React SDK automatically adds tokens to fetch requests

## Files to Modify

1. `client/src/components/auth/ClerkProviderWrapper.tsx` - Add domain configuration
2. `server/middleware/clerk.ts` - Enhance middleware configuration and add debugging
3. `server/middleware/cors.ts` - Verify Authorization header is allowed
4. `client/src/lib/queryClient.ts` - Verify token sending (may need Clerk token injection)

## Testing Strategy

1. Check browser Network tab for:

- Presence of `Authorization` header or Clerk session cookies
- CORS preflight responses
- 401 response details

2. Check server logs for:

- Token extraction debug messages
- CORS blocking warnings
- Auth context information

3. Verify Clerk dashboard:

- Frontend domain matches production URL
- API keys are correct
- No domain restrictions blocking requests

## Environment Variables to Verify

- `CLERK_PUBLISHABLE_KEY` - Must match frontend