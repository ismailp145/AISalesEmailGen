---
name: FireCrawl Integration Features
overview: "Implement two separate FireCrawl features: (1) Prospect company research to enhance trigger detection with real web data, and (2) User profile auto-fill that crawls the user's company website to populate profile fields automatically."
todos:
  - id: install-firecrawl
    content: Install @mendable/firecrawl-js package and add FIRECRAWL_API_KEY to environment variables
    status: completed
  - id: create-firecrawl-service
    content: Create server/firecrawl.ts service with scrapeCompanyWebsite and searchCompanyNews functions
    status: completed
  - id: enhance-trigger-detection
    content: Enhance detectTriggers() in server/openai.ts to use FireCrawl company data for better trigger detection
    status: completed
  - id: update-detect-triggers-api
    content: Update /api/detect-triggers endpoint to accept companyWebsite and integrate FireCrawl
    status: completed
  - id: update-prospect-form
    content: Add company website input field to SingleEmailForm component and pass to detect-triggers API
    status: completed
  - id: create-profile-extraction
    content: Create AI-powered profile extraction function that analyzes scraped website content
    status: pending
  - id: create-auto-fill-endpoint
    content: Create POST /api/profile/auto-fill endpoint that uses FireCrawl and AI to extract profile data
    status: pending
  - id: add-auto-fill-ui
    content: Add Auto-fill from Website button and functionality to SettingsPage component
    status: pending
  - id: update-schemas
    content: Update Zod schemas to include optional companyWebsite field in detectTriggersRequestSchema
    status: completed
---

# FireCrawl Integration Implementation Plan

## Overview

This plan implements two separate features using FireCrawl API for web scraping:

1. **Prospect Company Research** - Enhance trigger detection with real company website data
2. **User Profile Auto-fill** - Automatically populate user profile from company website

## Feature 1: Prospect Company Research for Trigger Detection

### Backend Changes

**1. Install FireCrawl SDK**

- Add `@mendable/firecrawl-js` to `package.json` dependencies

**2. Create FireCrawl Service** (`server/firecrawl.ts`)

- Initialize FireCrawl client with `FIRECRAWL_API_KEY` environment variable
- Create `scrapeCompanyWebsite(url: string)` function that:
- Scrapes the company website URL
- Extracts markdown content
- Returns structured company information (description, products, recent news, etc.)
- Create `searchCompanyInfo(companyName: string)` function that:
- Uses FireCrawl to search for company information
- Returns relevant company data for trigger detection

**3. Enhance Trigger Detection** (`server/openai.ts`)

- Modify `detectTriggers()` function to:
- Accept optional `companyWebsite` parameter
- If company website is provided, use FireCrawl to scrape company data
- Pass scraped company data to AI prompt for more accurate trigger detection
- Include company-specific information (products, recent updates, news) in trigger analysis

**4. Update API Route** (`server/routes.ts`)

- Modify `/api/detect-triggers` endpoint to:
- Accept optional `companyWebsite` in request body
- Call FireCrawl service if website is provided
- Pass company data to `detectTriggers()` function

**5. Update Schema** (`shared/schema.ts`)

- Update `detectTriggersRequestSchema` to include optional `companyWebsite` field

### Frontend Changes

**1. Update SingleEmailForm** (`client/src/components/SingleEmailForm.tsx`)

- Add optional "Company Website" input field in prospect form
- When user clicks "Detect Triggers", include company website URL in API request
- Show loading state while FireCrawl is scraping company data
- Display company information found (if any) alongside triggers

**2. Update Prospect Schema**

- Ensure prospect form can handle company website URL

## Feature 2: User Profile Auto-fill from Company Website

### Backend Changes

**1. Create Profile Auto-fill Endpoint** (`server/routes.ts`)

- Add new endpoint: `POST /api/profile/auto-fill`
- Accepts `companyWebsite` URL in request body
- Uses FireCrawl to crawl/scrape the company website
- Uses AI (OpenAI) to extract and structure company information:
- Company description
- Product/service name and description
- Value proposition
- Target audience
- Industry
- Pain points (if mentioned)
- Differentiators (if mentioned)
- Returns structured profile data that can be merged with existing profile

**2. Create Profile Extraction Service** (`server/openai.ts` or new `server/profileExtraction.ts`)

- Create `extractProfileFromWebsite(websiteContent: string, companyName: string)` function
- Uses AI to analyze scraped website content
- Extracts relevant fields matching `UserProfile` schema
- Returns partial profile object with extracted fields

**3. Integrate FireCrawl** (`server/firecrawl.ts`)

- Add `crawlCompanyWebsite(url: string)` function for full website crawl
- Returns comprehensive website content for AI analysis

### Frontend Changes

**1. Update SettingsPage** (`client/src/pages/SettingsPage.tsx`)

- Add "Auto-fill from Website" button next to Company Website input field
- When clicked:
- Validates that company website URL is provided
- Calls `/api/profile/auto-fill` endpoint
- Shows loading state during scraping and AI extraction
- Merges extracted data into form fields (user can review and edit)
- Shows toast notification with success/error message
- Add visual indicator showing which fields were auto-filled

**2. UI Enhancements**

- Add loading spinner and progress indicator during auto-fill
- Show extracted data in a preview/confirmation step before applying
- Allow user to selectively apply extracted fields

## Implementation Details

### Environment Variables

- Add `FIRECRAWL_API_KEY` to environment variables (required for both features)

### Error Handling

- Handle FireCrawl API errors gracefully
- Show user-friendly error messages if scraping fails
- Fallback to existing trigger detection if FireCrawl fails (Feature 1)
- Allow manual profile entry if auto-fill fails (Feature 2)

### Rate Limiting & Performance

- Cache FireCrawl results to avoid repeated scraping of same URLs
- Add timeout handling for long-running crawl operations
- Show progress indicators for crawl operations

### Data Storage

- Optionally store scraped company data in database for future use
- Add `companyWebsite` field to prospects table if not already present
- Store last crawl timestamp to avoid unnecessary re-scraping

## Testing Considerations

- Test with various company website structures
- Handle edge cases (no website, invalid URL, blocked scraping)
- Verify AI extraction accuracy for profile fields
- Test trigger detection improvements with real company data

## Files to Modify/Create

**New Files:**

- `server/firecrawl.ts` - FireCrawl service wrapper
- `server/profileExtraction.ts` - AI-powered profile extraction (optional, can be in openai.ts)

**Modified Files:**

- `package.json` - Add FireCrawl dependency
- `server/routes.ts` - Add auto-fill endpoint, enhance detect-triggers endpoint
- `server/openai.ts` - Enhance detectTriggers function, add profile extraction function
- `shared/schema.ts` - Update schemas to include companyWebsite
- `client/src/components/SingleEmailForm.tsx` - Add company website input, enhance trigger detection
- `client/src/pages/SettingsPage.tsx` - Add auto-fill functionality

## Dependencies

- `@mendable/firecrawl-js` - FireCrawl Node.js SDK
- Existing OpenAI integration for AI-powered extraction