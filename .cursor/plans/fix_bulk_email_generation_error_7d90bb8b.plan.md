---
name: Fix Bulk Email Generation Error
overview: The error "(0 , Dk.default) is not a function" occurs because `p-limit` and `p-retry` are ES modules being incorrectly bundled by esbuild. The solution is to add them to the build allowlist so they remain external dependencies, or fix the import syntax to handle ESM/CJS interop correctly.
todos:
  - id: add-to-allowlist
    content: Add 'p-limit' and 'p-retry' to the allowlist in script/build.ts so they remain as external dependencies
    status: completed
  - id: move-imports
    content: Move p-limit and p-retry imports from mid-file to the top of server/openai.ts with other imports
    status: completed
  - id: test-build
    content: Rebuild the project and test bulk email generation to verify the fix
    status: completed
    dependencies:
      - add-to-allowlist
      - move-imports
---

# Fix Bulk Email Generation Error

## Problem Analysis

The error `(0 , Dk.default) is not a function` occurs in the bulk email generation endpoint (`/api/generate-emails-bulk`). This is a module import/export issue happening during the build process.

### Root Cause

1. **ESM/CJS Interop Issue**: The `p-limit` package is an ES module, and when esbuild bundles it to CommonJS format (`format: "cjs"` in `script/build.ts`), it's incorrectly handling the default export.
2. **Bundling Problem**: In `script/build.ts`, `p-limit` and `p-retry` are NOT in the `allowlist`, which means they're being bundled. ES modules bundled to CommonJS can cause interop issues.
3. **Import Location**: The imports are placed mid-file (line 234-235 in `server/openai.ts`), which might also contribute to bundling issues.

## Solution

### Option 1: Add to External Dependencies (Recommended)

Add `p-limit` and `p-retry` to the allowlist in `script/build.ts` so they remain as external dependencies and aren't bundled. This is the cleanest solution.

### Option 2: Fix Import Syntax

If bundling is required, change the import to handle ESM/CJS interop:

- Use `import * as pLimit from "p-limit"` or
- Use dynamic import, or  
- Ensure proper default export handling

### Option 3: Move Imports to Top

Move the imports from lines 234-235 to the top of the file with other imports to ensure proper module resolution.

## Implementation Steps

1. **Update build script** (`script/build.ts`):

- Add `"p-limit"` and `"p-retry"` to the `allowlist` array

2. **Move imports** (`server/openai.ts`):

- Move `import pLimit from "p-limit";` and `import pRetry, { AbortError } from "p-retry";` from line 234-235 to the top of the file with other imports (around line 1-5)

3. **Verify the fix**:

- Rebuild the project
- Test bulk email generation
- Check that the error no longer occurs

## Files to Modify

- `script/build.ts` - Add dependencies to allowlist
- `server/openai.ts` - Move imports to top of file

## Testing

After making changes:

1. Run `npm run build` to rebuild
2. Test bulk email generation with multiple prospects