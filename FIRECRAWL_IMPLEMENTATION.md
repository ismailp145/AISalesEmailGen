# FireCrawl Integration Implementation Summary

This document summarizes the FireCrawl integration features implemented in the Basho Studio application.

## Overview

Two main features have been implemented using FireCrawl API:

1. **Prospect Company Research** - Enhances trigger detection with real company website data and recent news
2. **User Profile Auto-fill** - Automatically populates user profile from company website

## Implementation Details

### 1. Backend Implementation

#### FireCrawl Service (`server/firecrawl.ts`)

Created a comprehensive FireCrawl service with the following functions:

- **`scrapeCompanyWebsite(url: string)`**: Scrapes a single company website URL and extracts markdown content
- **`crawlCompanyWebsite(url: string, maxPages: number)`**: Crawls multiple pages of a company website for comprehensive data extraction
- **`searchCompanyNews(companyName: string, limit: number)`**: Searches Google News for recent company news articles
- **`searchCompanyInfo(companyName: string, companyWebsite?: string)`**: Combined function that runs website scraping and news search in parallel
- **`researchCompany(companyName: string, companyWebsite?: string)`**: Alias for compatibility with existing code

**Key Features:**
- Parallel execution of website scraping and news search for better performance
- Graceful error handling with fallbacks
- Configurable timeouts (30-60 seconds)
- News parsing from Google News search results
- Markdown content extraction for AI processing

#### Enhanced Trigger Detection (`server/openai.ts`)

Enhanced the `detectTriggers()` function to:
- Accept optional company data (website info + recent news)
- Build AI prompts that incorporate real company data
- Prioritize triggers based on actual news articles and website content
- Return metadata about data sources used

Added `extractProfileFromWebsite()` function:
- Uses AI to analyze scraped website content
- Extracts structured profile information (company description, products, value proposition, etc.)
- Returns only non-empty fields for selective auto-fill

#### API Endpoints (`server/routes.ts`)

**Enhanced `/api/detect-triggers` endpoint:**
- Accepts optional `companyWebsite` parameter
- Extracts `companyName` from prospect data
- Calls FireCrawl to research company (website + news) in parallel
- Passes enriched data to trigger detection
- Gracefully falls back to basic trigger detection if FireCrawl fails

**Created `/api/profile/auto-fill` endpoint:**
- Accepts `companyWebsite` and `companyName` parameters
- Crawls the company website using FireCrawl
- Uses AI to extract profile fields
- Returns extracted fields for user review before saving

### 2. Frontend Implementation

#### Single Email Form (`client/src/components/SingleEmailForm.tsx`)

- Added `companyWebsite` field to the form schema
- Company Website input field with helpful description
- Automatically passes company website to detect-triggers API
- Shows visual indicator (✨) for enhanced triggers
- Displays loading state during FireCrawl operations

#### Settings Page (`client/src/pages/SettingsPage.tsx`)

- Added "Auto-fill" button next to Company Website field
- Mutation hook for calling `/api/profile/auto-fill` endpoint
- Visual indicators (✨) for auto-filled fields
- Merges extracted data into form for user review
- Toast notifications for success/error states
- Clears auto-fill indicators after saving

### 3. Schema Updates (`shared/schema.ts`)

- `detectTriggersRequestSchema` already included optional `companyWebsite` field
- `DetectTriggersResponse` interface includes optional `companyData` metadata

## Environment Variables

### Required for FireCrawl Features

```bash
FIRECRAWL_API_KEY=fc-your-api-key-here
```

Get your API key from https://firecrawl.dev

## Features Enabled

### Feature 1: Enhanced Trigger Detection

**How it works:**
1. User enters prospect information including optional company website
2. When "Detect Triggers" is clicked:
   - FireCrawl scrapes the company website (if provided)
   - FireCrawl searches Google News for recent company news
   - Both operations run in parallel for speed
3. AI analyzes the real data to generate specific, accurate triggers
4. Triggers based on actual news articles are prioritized as "high relevance"

**Benefits:**
- Real, specific triggers instead of generic placeholders
- Recent news articles provide timely conversation starters
- Website data provides accurate company context
- Parallel execution keeps response times fast

### Feature 2: Profile Auto-fill

**How it works:**
1. User enters company name and website URL in Settings
2. Clicks "Auto-fill" button
3. FireCrawl crawls the company website (up to 5 pages)
4. AI extracts relevant profile information:
   - Company description
   - Industry
   - Product/service name and description
   - Value proposition
   - Target audience
   - Pain points
   - Differentiators
   - Social proof
5. Extracted fields are populated in the form with ✨ indicators
6. User reviews and saves the profile

**Benefits:**
- Saves time filling out profile manually
- Ensures accurate company information
- AI extracts only relevant, present information
- User maintains control with review step

## Error Handling

- FireCrawl errors don't break the application
- Graceful fallbacks to existing functionality
- User-friendly error messages
- Timeout handling for long-running operations
- Validation of scraped content quality

## Performance Optimizations

- Parallel execution of website scraping and news search
- Configurable timeouts (30-60 seconds)
- Content length validation before AI processing
- Efficient markdown extraction
- Caching potential for future enhancements

## Testing Recommendations

1. Test with various company websites (different structures, sizes)
2. Test news search with different company names (common vs unique)
3. Test error scenarios (invalid URLs, blocked scraping, no news found)
4. Verify trigger quality with real company data
5. Test profile auto-fill accuracy across different industries
6. Test performance with both features running simultaneously

## Future Enhancements

Potential improvements for future iterations:

1. **Caching**: Cache scraped data to avoid redundant API calls
2. **Rate Limiting**: Implement rate limiting for FireCrawl API calls
3. **Progress Indicators**: Show detailed progress during scraping/crawling
4. **Selective Auto-fill**: Allow users to choose which fields to auto-fill
5. **News Filtering**: Add date range filters for news search
6. **Multiple Sources**: Integrate additional news sources beyond Google News
7. **Batch Processing**: Support bulk prospect research
8. **Database Storage**: Store scraped data for historical analysis

## API Usage

### Detect Triggers with Company Research

```typescript
POST /api/detect-triggers
{
  "prospect": {
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Inc",
    "title": "VP of Sales",
    "email": "john@acme.com"
  },
  "companyWebsite": "https://acme.com" // Optional
}
```

### Auto-fill Profile

```typescript
POST /api/profile/auto-fill
{
  "companyWebsite": "https://mycompany.com",
  "companyName": "My Company Inc"
}
```

## Files Modified/Created

### New Files
- `server/firecrawl.ts` - FireCrawl service wrapper with all scraping/crawling functions

### Modified Files
- `server/routes.ts` - Added imports, enhanced detect-triggers endpoint
- `server/openai.ts` - Added extractProfileFromWebsite function
- `README.md` - Added FireCrawl configuration documentation
- `client/src/components/SingleEmailForm.tsx` - Already had company website field
- `client/src/pages/SettingsPage.tsx` - Already had auto-fill functionality

## Dependencies

- `@mendable/firecrawl-js` (v4.8.3) - FireCrawl Node.js SDK
- Existing OpenAI integration for AI-powered extraction
- Existing React Query for API state management

## Conclusion

The FireCrawl integration successfully implements two powerful features that enhance the Basho Studio application:

1. **Prospect Research** provides real, timely data for trigger detection
2. **Profile Auto-fill** saves time and ensures accurate company information

Both features are optional (require FIRECRAWL_API_KEY) and gracefully degrade if not configured, maintaining backward compatibility with existing functionality.
