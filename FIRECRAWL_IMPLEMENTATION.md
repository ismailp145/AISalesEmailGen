# Firecrawl Integration - Company News Search & Web Scraping

## Overview

This implementation adds powerful company research capabilities to the AI Sales Email Generator using Firecrawl. The system can now:

1. **Scrape company websites** to extract real information about products, services, and company focus
2. **Search for recent news** about the company to find timely, relevant triggers
3. **Enhance trigger detection** with real, specific data instead of generic suggestions

## Features Implemented

### 1. Company Website Scraping

When a user provides a company website URL, the system:
- Scrapes the website using Firecrawl's API
- Extracts structured content in markdown format
- Captures metadata like title, description, and keywords
- Feeds this real data to the AI for accurate trigger generation

### 2. Company News Search

The system automatically searches for recent news about the company:
- Uses Firecrawl's search API to find news articles, press releases, and announcements
- Extracts key information: title, description, source, and date
- Ranks news items by relevance (high/medium/low)
- Prioritizes news from reputable sources

### 3. Enhanced Trigger Detection

The AI now generates triggers based on:
- **Real website data**: Actual products, services, and company information
- **Recent news**: Timely events like funding rounds, product launches, partnerships
- **Specific details**: Company-specific triggers instead of generic industry trends

## Technical Implementation

### Backend Changes

#### 1. New Service: `server/firecrawl.ts`

Created a comprehensive Firecrawl service with the following functions:

- **`scrapeCompanyWebsite(url: string)`**: Scrapes a company website and returns structured data
- **`searchCompanyNews(companyName: string, limit: number)`**: Searches for recent news about a company
- **`researchCompany(companyName: string, companyWebsite?: string)`**: Combines website scraping and news search for comprehensive research
- **`crawlCompanyWebsite(url: string)`**: Full website crawl for future profile auto-fill feature
- **`isFirecrawlConfigured()`**: Checks if Firecrawl API key is configured

#### 2. Enhanced OpenAI Service: `server/openai.ts`

Updated trigger detection to accept and use company data:

- **`buildTriggerDetectionPrompt()`**: Now accepts optional company data (website info and news)
- **`detectTriggers()`**: Enhanced to process company data and generate more accurate triggers
- Improved prompts that prioritize real data over generic suggestions

#### 3. Updated API Endpoint: `/api/detect-triggers`

Enhanced the endpoint to:
- Accept optional `companyWebsite` parameter
- Call Firecrawl service when company info is available
- Pass company data to AI for trigger detection
- Handle errors gracefully (continues without company data if Firecrawl fails)

#### 4. Schema Updates: `shared/schema.ts`

- Added `companyWebsite` field to `detectTriggersRequestSchema`
- Updated `DetectTriggersResponse` to include company data metadata

### Frontend Changes

#### Updated Component: `client/src/components/SingleEmailForm.tsx`

Added new UI elements:
- **Company Website input field** with helpful description
- Visual indicator showing the field enhances trigger detection (✨ icon)
- Passes company website to the detect-triggers API
- Maintains backward compatibility (field is optional)

## Usage

### For Users

1. **Fill in prospect details** (name, company, title, email)
2. **Optionally add company website** (e.g., `https://acme.com`)
3. **Click "Find Triggers"**
4. The system will:
   - Scrape the company website for real information
   - Search for recent news about the company
   - Generate specific, accurate triggers based on real data
5. **Review and select triggers** to include in your email
6. **Generate email** with selected triggers

### Example Workflow

**Without Company Website:**
- Generic triggers like "Company expanding in their industry"
- AI makes educated guesses based on company name

**With Company Website:**
- Specific triggers like "Recently launched new AI-powered analytics platform (from website)"
- Real news: "Raised $50M Series B funding last week (TechCrunch)"
- Actual products: "Your new customer data platform for enterprise teams"

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

Get your API key from: https://www.firecrawl.dev/

### Health Check

The system includes Firecrawl status in the health check endpoint:

```bash
GET /api/health
```

Response includes:
```json
{
  "status": "ok",
  "ai": "configured",
  "firecrawl": "configured",
  ...
}
```

## API Reference

### POST /api/detect-triggers

**Request Body:**
```json
{
  "prospect": {
    "firstName": "Sarah",
    "lastName": "Johnson",
    "company": "Acme Corp",
    "title": "VP of Sales",
    "email": "sarah@acme.com",
    "linkedinUrl": "https://linkedin.com/in/sarah",
    "notes": "Interested in our analytics platform"
  },
  "companyWebsite": "https://acme.com"  // Optional
}
```

**Response:**
```json
{
  "triggers": [
    {
      "id": "abc123",
      "type": "news",
      "title": "Acme Corp Raises $50M Series B",
      "description": "Company announced major funding round to expand AI capabilities...",
      "relevance": "high",
      "source": "TechCrunch",
      "date": "This week",
      "selected": true
    },
    {
      "id": "def456",
      "type": "company_event",
      "title": "Launched New Analytics Platform",
      "description": "From their website: Recently launched AI-powered analytics for enterprise teams...",
      "relevance": "high",
      "source": "Company Website",
      "date": "Recent",
      "selected": true
    }
  ],
  "prospectSummary": "Sarah Johnson is the VP of Sales at Acme Corp, a growing company focused on AI-powered analytics...",
  "companyData": {
    "websiteInfo": "Website data included",
    "recentNews": "5 news items found"
  }
}
```

## Error Handling

The implementation includes robust error handling:

1. **Firecrawl not configured**: System falls back to AI-generated triggers without real data
2. **Website scraping fails**: Continues with news search only
3. **News search fails**: Continues with website data only
4. **Both fail**: Falls back to original AI-generated triggers
5. **Invalid URL**: Returns validation error to user

All errors are logged but don't break the user experience.

## Performance Considerations

- **Parallel execution**: Website scraping and news search run in parallel
- **Timeout handling**: Firecrawl requests have appropriate timeouts
- **Caching**: Consider implementing caching for frequently accessed companies (future enhancement)
- **Rate limiting**: Firecrawl API has rate limits - handle accordingly

## Future Enhancements

### Profile Auto-fill (Planned)

The foundation is in place for profile auto-fill:
- `crawlCompanyWebsite()` function ready for multi-page crawling
- Can extract company description, products, value proposition from website
- Will populate user profile fields automatically

### Caching Layer

Add Redis or similar caching:
- Cache scraped website data for 24 hours
- Cache news search results for 1 hour
- Reduce API calls and improve response time

### Advanced News Filtering

- Filter by date range (last 7 days, 30 days, etc.)
- Filter by news type (funding, product launch, partnership, etc.)
- Prioritize news from specific sources

## Testing

### Manual Testing Checklist

- [ ] Test with valid company website URL
- [ ] Test with invalid URL (should show validation error)
- [ ] Test without company website (should work with AI-generated triggers)
- [ ] Test with company that has recent news
- [ ] Test with company that has no recent news
- [ ] Test Firecrawl not configured (should fall back gracefully)
- [ ] Test trigger selection and email generation with real triggers

### Example Test Companies

Good companies to test with:
- **OpenAI** (openai.com) - Lots of recent news
- **Stripe** (stripe.com) - Well-structured website
- **Anthropic** (anthropic.com) - Recent funding and product launches

## Dependencies

- **@mendable/firecrawl-js**: ^1.x (installed)
- Requires Firecrawl API key from https://www.firecrawl.dev/

## Files Modified/Created

### New Files
- `server/firecrawl.ts` - Firecrawl service implementation

### Modified Files
- `server/openai.ts` - Enhanced trigger detection
- `server/routes.ts` - Updated detect-triggers endpoint
- `shared/schema.ts` - Added companyWebsite field
- `client/src/components/SingleEmailForm.tsx` - Added company website input
- `package.json` - Added Firecrawl dependency

## Troubleshooting

### "Firecrawl is not configured"

**Solution**: Add `FIRECRAWL_API_KEY` to your environment variables

### "Failed to scrape company website"

**Possible causes**:
- Invalid URL format
- Website blocks scraping
- Firecrawl API rate limit exceeded
- Network connectivity issues

**Solution**: System will continue with news search or fall back to AI-generated triggers

### Triggers are still generic

**Check**:
- Is Firecrawl API key configured?
- Is the company website URL valid?
- Does the company have recent news?
- Check server logs for Firecrawl errors

## Conclusion

This implementation significantly enhances the trigger detection feature by providing real, timely, and specific information about prospect companies. Users can now generate highly personalized emails based on actual company data and recent news, leading to better engagement and response rates.
