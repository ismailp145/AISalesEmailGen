// Use dynamic import to avoid bundling issues with ESM packages
let Firecrawl: any = null;
let firecrawl: any = null;

// Initialize Firecrawl client lazily
async function initializeFirecrawl() {
  if (Firecrawl) return; // Already initialized
  
  try {
    const firecrawlModule = await import("@mendable/firecrawl-js");
    Firecrawl = firecrawlModule.default || firecrawlModule;
    
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (firecrawlApiKey) {
      firecrawl = new Firecrawl({ apiKey: firecrawlApiKey });
      console.log("[Firecrawl] Initialized with API key");
    } else {
      console.log("[Firecrawl] API key not configured - web scraping features disabled");
    }
  } catch (error) {
    console.error("[Firecrawl] Failed to load module:", error);
    firecrawl = null;
  }
}

// Initialize on module load (but don't block)
initializeFirecrawl().catch(err => {
  console.error("[Firecrawl] Initialization error:", err);
});

export function isFirecrawlConfigured(): boolean {
  return !!firecrawl;
}
/**
 * 
 * @param scrapeResult - The result of the scrape
 * @param url - The URL of the website
 * @returns The processed result
 */
function processResult(scrapeResult: any, url: string): CompanyWebsiteData {
  return {
    url,
    title: scrapeResult.metadata?.title || "",
    description: scrapeResult.metadata?.description || "",
    content: scrapeResult.markdown || scrapeResult.html || "",
    metadata: {
      keywords: scrapeResult.metadata?.keywords 
        ? (typeof scrapeResult.metadata.keywords === 'string' 
            ? scrapeResult.metadata.keywords.split(",").map((k: string) => k.trim()) 
            : [])
        : [],
    },
  };
}


// ============================================
// Company Website Scraping
// ============================================

export interface CompanyWebsiteData {
  url: string;
  title?: string;
  description?: string;
  content: string; // Markdown content
  metadata?: {
    products?: string[];
    services?: string[];
    industry?: string;
    keywords?: string[];
  };
}

/**
 * Scrapes a company website and extracts structured information
 * @param url - The company website URL to scrape
 * @returns Structured company data from the website
 */
export async function scrapeCompanyWebsite(url: string): Promise<CompanyWebsiteData> {
  await initializeFirecrawl();
  if (!firecrawl) {
    throw new Error("Firecrawl is not configured. Please set FIRECRAWL_API_KEY.");
  }

  try {
    // Try with proper SSL verification first
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ["markdown", "html"],
      onlyMainContent: true,
      // skipTlsVerification: false by default
    });
    
    return processResult(scrapeResult, url);
  } catch (error: any) {
    // Only for SSL errors on untrusted sites, try HTTP fallback
    if (error?.message?.includes("SSL") && url.startsWith("https://")) {
      console.warn(`[Firecrawl] SSL error for ${url}, attempting HTTP fallback`);
      const httpUrl = url.replace("https://", "http://");
      return scrapeCompanyWebsite(httpUrl);
    }
    handleFirecrawlError(error, "scraping company website");
  }
}


// ============================================
// Company News Search
// ============================================

export interface CompanyNewsItem {
  title: string;
  description: string;
  url: string;
  publishedDate?: string;
  source?: string;
  relevance: "high" | "medium" | "low";
}

export interface CompanyNewsSearchResult {
  companyName: string;
  newsItems: CompanyNewsItem[];
  searchQuery: string;
}

/**
 * Searches for recent news about a company using Firecrawl's search capabilities
 * @param companyName - The name of the company to search for
 * @param limit - Maximum number of news items to return (default: 5)
 * @returns Recent news articles about the company
 */
export async function searchCompanyNews(
  companyName: string,
  limit: number = 5
): Promise<CompanyNewsSearchResult> {
  await initializeFirecrawl();
  if (!firecrawl) {
    throw new Error("Firecrawl is not configured. Please set FIRECRAWL_API_KEY.");
  }

  try {
    console.log("[Firecrawl] Searching for news about:", companyName);

    // Build search query for recent company news
    const searchQuery = `${companyName} news OR ${companyName} announcement OR ${companyName} press release`;

    // Use Firecrawl's search capability to find recent news
    const searchResult = await firecrawl.search(searchQuery, {
      limit: limit,
      sources: ["news", "web"],
    });

    const newsItems: CompanyNewsItem[] = [];

    // Process news results
    if (searchResult.news) {
      for (const result of searchResult.news.slice(0, limit)) {
        // Use type guard to check if it's a SearchResultNews
        if (isSearchResultNews(result)) {
          const newsItem: CompanyNewsItem = {
            title: result.title || "Untitled",
            description: result.snippet || "",
            url: result.url || "",
            publishedDate: result.date || "Recent",
            source: extractDomain(result.url || ""),
            relevance: determineRelevance(result.title || "", result.snippet || "", companyName),
          };

          newsItems.push(newsItem);
        }
      }
    }

    // Also process web results if we don't have enough news
    if (newsItems.length < limit && searchResult.web) {
      for (const result of searchResult.web.slice(0, limit - newsItems.length)) {
        // Use type guard to check if it's a SearchResultWeb
        if (isSearchResultWeb(result)) {
          const newsItem: CompanyNewsItem = {
            title: result.title || "Untitled",
            description: result.description || "",
            url: result.url || "",
            publishedDate: "Recent",
            source: extractDomain(result.url || ""),
            relevance: determineRelevance(result.title || "", result.description || "", companyName),
          };

          newsItems.push(newsItem);
        }
      }
    }

    console.log("[Firecrawl] Found", newsItems.length, "news items for:", companyName);

    return {
      companyName,
      newsItems,
      searchQuery,
    };
  } catch (error: any) {
    handleFirecrawlError(error, "searching for company news");
  }
}

/**
 * Combines website scraping and news search for comprehensive company research
 * @param companyName - The name of the company
 * @param companyWebsite - Optional company website URL
 * @returns Combined company data and news
 */
export async function researchCompany(
  companyName: string,
  companyWebsite?: string
): Promise<{
  websiteData?: CompanyWebsiteData;
  newsData: CompanyNewsSearchResult;
}> {
  await initializeFirecrawl();
  if (!firecrawl) {
    throw new Error("Firecrawl is not configured. Please set FIRECRAWL_API_KEY.");
  }

  console.log("[Firecrawl] Starting comprehensive company research:", companyName);

  // Run website scraping and news search in parallel
  const [websiteData, newsData] = await Promise.allSettled([
    companyWebsite ? scrapeCompanyWebsite(companyWebsite) : Promise.resolve(undefined),
    searchCompanyNews(companyName, 5),
  ]);

  const result: {
    websiteData?: CompanyWebsiteData;
    newsData: CompanyNewsSearchResult;
  } = {
    newsData: newsData.status === "fulfilled" 
      ? newsData.value 
       : (() => {  
          console.error("[Firecrawl] News search failed for:", companyName, "Reason:", newsData.reason);  
          return { companyName, newsItems: [], searchQuery: "", error: newsData.reason instanceof Error ? newsData.reason.message : String(newsData.reason) };  
        })(),  
  };

  if (websiteData.status === "fulfilled" && websiteData.value) {
    result.websiteData = websiteData.value;
  }

  console.log("[Firecrawl] Company research completed for:", companyName);

  return result;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Handles Firecrawl errors with specific error messages and logging
 * @param error - The error object caught
 * @param context - Context string describing the operation (e.g., "scraping company website")
 * @throws Error with formatted message and original error as cause
 */
function handleFirecrawlError(error: any, context: string): never {
  // Log the full error object for debugging
  console.error(`[Firecrawl] Error ${context}:`, error);

  // Attempt to provide more specific error messages
  let errorMsg = "Unknown error";
  if (error?.response?.status === 429) {
    errorMsg = `Rate limit exceeded while ${context}.`;
  } else if (error?.code === "ENOTFOUND" || error?.code === "ECONNREFUSED" || error?.code === "ECONNRESET") {
    errorMsg = `Network error while ${context}: ${error.message || error.code}`;
  } else if (error?.message) {
    errorMsg = error.message;
  }

  // Throw a new error, preserving the original error as the cause (Node.js >= 16.9.0)
  throw new Error(`Failed to ${context}: ${errorMsg}`, { cause: error });
}

/**
 * Type guard to check if result is a SearchResultNews
 */
function isSearchResultNews(result: any): result is { title?: string; url?: string; snippet?: string; date?: string } {
  return !('markdown' in result) && ('snippet' in result || 'date' in result);
}

/**
 * Type guard to check if result is a SearchResultWeb
 */
function isSearchResultWeb(result: any): result is { url: string; title?: string; description?: string } {
  return !('markdown' in result) && 'url' in result && !('snippet' in result);
}

/**
 * Extracts domain name from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch (error) {
    console.error(`[extractDomain] Failed to parse URL "${url}":`, error);
    return "Unknown";
  }
}

/**
 * Determines relevance of a news item based on title and description
 */
function determineRelevance(
  title: string,
  description: string,
  companyName: string
): "high" | "medium" | "low" {
  const text = `${title} ${description}`.toLowerCase();
  const company = companyName.toLowerCase();

  // High relevance: Company name appears multiple times or in title with key terms
  const highRelevanceTerms = [
    "announces",
    "launches",
    "raises",
    "funding",
    "acquisition",
    "partnership",
    "expands",
    "opens",
    "hires",
    "appoints",
  ];

  const titleLower = title.toLowerCase();
  if (titleLower.includes(company)) {
    if (highRelevanceTerms.some((term) => text.includes(term))) {
      return "high";
    }
    return "medium";
  }

  // Medium relevance: Company name appears in description
  if (text.includes(company)) {
    return "medium";
  }

  // Low relevance: Related but not directly about the company
  return "low";
}

// ============================================
// Profile Auto-fill (for future use)
// ============================================

/**
 * Crawls a company website more comprehensively for profile auto-fill
 * @param url - The company website URL
 * @returns Comprehensive website content for AI analysis
 */
export async function crawlCompanyWebsite(url: string): Promise<string> {
  await initializeFirecrawl();
  if (!firecrawl) {
    throw new Error("Firecrawl is not configured. Please set FIRECRAWL_API_KEY.");
  }

  try {
    console.log("[Firecrawl] Crawling company website:", url);

    // For now, use scrape instead of full crawl (crawl can be expensive)
    // In production, you might want to use firecrawl.startCrawl for multi-page crawling
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ["markdown"],
      onlyMainContent: true,
    });

    console.log("[Firecrawl] Successfully crawled website:", url);

    return scrapeResult.markdown || "";
  } catch (error: any) {
    handleFirecrawlError(error, "crawling company website");
  }
}
