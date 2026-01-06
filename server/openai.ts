import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { Prospect, GeneratedEmail, UserProfile, DetectedTrigger, DetectTriggersResponse } from "@shared/schema";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// Configure OpenRouter as the provider using Vercel AI SDK
const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "",
});

// Fallback to direct OpenAI if OPENROUTER_API_KEY is not set
const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
const useAIIntegrations = !process.env.OPENAI_API_KEY && !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const provider = useOpenRouter ? openrouter : createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
  baseURL: useAIIntegrations && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL 
    ? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL 
    : "https://api.openai.com/v1",
});

console.log(`[AI] Using ${useOpenRouter ? "OpenRouter" : "OpenAI"} provider`);

/**
 * Extracts JSON content from AI response text, handling potential markdown code blocks.
 */
function extractJsonFromResponse(text: string): string {
  if (text.includes("```json")) {
    return text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  } else if (text.includes("```")) {
    return text.replace(/```\n?/g, "");
  }
  return text;
}

/**
 * Intelligently truncates text to a maximum length, respecting word boundaries.
 * Prefers truncating at sentence boundaries, falls back to word boundaries.
 * 
 * @param text - The text to truncate
 * @param maxLength - Maximum character length
 * @returns Truncated text that ends at a word or sentence boundary
 */
function truncateIntelligently(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.substring(0, maxLength);
  
  // First, try to truncate at a sentence boundary (period, exclamation, question mark followed by space)
  // Look for sentence endings in reverse order
  for (let i = truncated.length - 1; i >= maxLength * 0.7; i--) {
    if (/[.!?]/.test(truncated[i])) {
      // Check if followed by whitespace and optionally a capital letter
      const after = truncated.substring(i + 1, Math.min(i + 10, truncated.length));
      if (/^\s+[A-Z]/.test(after) || /^\s*$/.test(after)) {
        return truncated.substring(0, i + 1).trim();
      }
    }
  }

  // Fall back to word boundary truncation (find last space)
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex).trim();
  }

  // If no good boundary found, return truncated text (should be rare)
  return truncated.trim();
}

interface EmailGenerationOptions {
  prospect: Prospect;
  tone: "casual" | "professional" | "hyper-personal";
  length: "short" | "medium";
  profile?: UserProfile;
  triggers?: DetectedTrigger[];
  linkedinContent?: string;
}

function buildPrompt(options: EmailGenerationOptions): string {
  const { prospect, tone, length, profile, triggers, linkedinContent } = options;
  
  const toneInstructions = {
    casual: "Write in a friendly, conversational tone. Use contractions and casual language.",
    professional: "Write in a polished, professional tone. Be respectful and business-appropriate.",
    "hyper-personal": "Write in an extremely personalized way. Reference specific details about their role, company, and any context provided. Make it feel like you know them.",
  };

  const lengthInstructions = {
    short: "Keep the email concise - no more than 3-4 sentences in the body. Get straight to the point.",
    medium: "Write a moderate-length email - about 4-6 sentences in the body. Include enough context but stay focused.",
  };

  const linkedinUrlContext = prospect.linkedinUrl 
    ? `\nLinkedIn Profile URL: ${prospect.linkedinUrl}` 
    : "";
  
  const notesContext = prospect.notes 
    ? `\nAdditional Context: ${prospect.notes}` 
    : "";

  // LinkedIn content paste section
  let linkedinContentSection = "";
  if (linkedinContent) {
    linkedinContentSection = `\n\nLINKEDIN PROFILE CONTENT (use this for deep personalization):
${linkedinContent}

Use insights from this LinkedIn content to personalize the email. Reference their:
- Headline or current role
- Recent posts or articles
- Career history or achievements
- Skills or expertise areas
- Education or certifications`;
  }

  // Build trigger context if provided
  let triggerContext = "";
  if (triggers && triggers.length > 0) {
    const selectedTriggers = triggers.filter(t => t.selected);
    if (selectedTriggers.length > 0) {
      triggerContext = `\n\nDETECTED TRIGGERS (use these as personalization hooks in your email opener):
${selectedTriggers.map((t, i) => `${i + 1}. [${t.type.toUpperCase()}] ${t.title}: ${t.description} (Source: ${t.source}, ${t.date || 'Recent'})`).join("\n")}

IMPORTANT: Reference at least one of these triggers naturally in your email opening to show you've done research on them.`;
    }
  }

  // Build sender context from profile
  let senderContext = "";
  let signatureName = "Alex";
  
  if (profile && profile.senderName) {
    signatureName = profile.senderName.split(" ")[0]; // First name only
    
    const senderDetails: string[] = [];
    if (profile.senderName) senderDetails.push(`Sender Name: ${profile.senderName}`);
    if (profile.senderTitle) senderDetails.push(`Sender Title: ${profile.senderTitle}`);
    if (profile.companyName) senderDetails.push(`Company: ${profile.companyName}`);
    if (profile.industry) senderDetails.push(`Industry: ${profile.industry}`);
    if (profile.companyDescription) senderDetails.push(`Company Description: ${profile.companyDescription}`);
    if (profile.productName) senderDetails.push(`Product/Service: ${profile.productName}`);
    if (profile.productDescription) senderDetails.push(`Product Description: ${profile.productDescription}`);
    if (profile.valueProposition) senderDetails.push(`Value Proposition: ${profile.valueProposition}`);
    if (profile.targetAudience) senderDetails.push(`Target Audience: ${profile.targetAudience}`);
    if (profile.painPoints) senderDetails.push(`Pain Points We Solve: ${profile.painPoints}`);
    if (profile.differentiators) senderDetails.push(`Differentiators: ${profile.differentiators}`);
    if (profile.socialProof) senderDetails.push(`Social Proof: ${profile.socialProof}`);
    if (profile.calendarLink) senderDetails.push(`Calendar Link for Booking: ${profile.calendarLink}`);
    
    if (senderDetails.length > 0) {
      senderContext = `\n\nSENDER CONTEXT (use this to inform the pitch, but keep focus on the prospect):
${senderDetails.join("\n")}`;
    }
  }

  return `You are an expert sales copywriter specializing in Basho-style cold outreach emails. Basho emails are highly personalized, pattern-interrupt emails that demonstrate genuine research about the prospect and create curiosity.

Generate a personalized cold sales email for the following prospect:

Name: ${prospect.firstName} ${prospect.lastName}
Title: ${prospect.title}
Company: ${prospect.company}
Email: ${prospect.email}${linkedinUrlContext}${notesContext}${linkedinContentSection}${triggerContext}${senderContext}

TONE: ${toneInstructions[tone]}

LENGTH: ${lengthInstructions[length]}

BASHO EMAIL PRINCIPLES:
1. Start with a personalized observation or compliment about them, their company, or recent achievements
2. Create curiosity without being manipulative
3. Keep it about THEM, not you or your product - but subtly connect to how you can help
4. End with a soft, low-commitment call to action${profile?.calendarLink ? " (include the calendar link if appropriate)" : " (suggest specific times)"}
5. Be conversational and human - avoid corporate jargon
6. Never use generic phrases like "I hope this email finds you well"
7. If sender context is provided, weave in relevant value props naturally without being salesy

Return your response as a JSON object with two fields:
- "subject": A compelling, personalized subject line (max 60 characters, no generic phrases)
- "body": The email body text (use \\n for line breaks)

The email should be signed with just "Best," followed by "${signatureName}" (no full name or title).`;
}

export async function generateEmail(options: Omit<EmailGenerationOptions, 'profile'> & { triggers?: DetectedTrigger[]; linkedinContent?: string; userId: string }): Promise<GeneratedEmail> {
  // Fetch user profile to include in the prompt (use provided userId)
  const userId = options.userId;
  if (!userId) {
    throw new Error("Missing userId for email generation");
  }
  const profile = await storage.getUserProfile(userId);
  const optionsWithProfile: EmailGenerationOptions = { ...options, profile, triggers: options.triggers, linkedinContent: options.linkedinContent };
  
  const prompt = buildPrompt(optionsWithProfile);

  console.log("[AI] Starting email generation for:", options.prospect.firstName, options.prospect.lastName);
  console.log("[AI] Profile loaded:", profile.senderName ? `${profile.senderName} @ ${profile.companyName}` : "No profile set");
  console.log("[AI] Using:", useOpenRouter ? "OpenRouter" : "OpenAI");

  try {
    const model = useOpenRouter ? "anthropic/claude-sonnet-4.5" : "anthropic/claude-3.7-sonnet";
    
    const { text } = await generateText({
      model: provider(model),
      prompt,
      maxOutputTokens: 1024,
    });

    console.log("[AI] Response received");

    if (!text) {
      console.error("[AI] No content in response");
      throw new Error("No response from AI");
    }

    const jsonContent = extractJsonFromResponse(text);
    const parsed = JSON.parse(jsonContent.trim());
    console.log("[AI] Successfully parsed email for:", options.prospect.firstName);
    
    return {
      subject: parsed.subject,
      body: parsed.body,
    };
  } catch (error: any) {
    console.error("[AI] Error:", error?.message || error);
    throw error;
  }
}

// Batch processing with rate limiting

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export async function generateEmailsBatch(
  prospects: Array<{
    prospect: Prospect;
    tone: "casual" | "professional" | "hyper-personal";
    length: "short" | "medium";
    linkedinContent?: string;
    userId: string;
  }>,
  onProgress?: (index: number, result: GeneratedEmail | Error) => void
): Promise<Array<{ email?: GeneratedEmail; error?: string }>> {
  const limit = pLimit(2); // Process up to 2 requests concurrently

  const results = await Promise.all(
    prospects.map((options, index) =>
      limit(async () => {
        try {
          const email = await pRetry(
            async () => generateEmail(options),
            {
              retries: 5,
              minTimeout: 2000,
              maxTimeout: 30000,
              factor: 2,
              onFailedAttempt: (context) => {
                if (!isRateLimitError(context)) {
                  throw new AbortError(String(context));
                }
              },
            }
          );
          onProgress?.(index, email);
          return { email };
        } catch (error: any) {
          const errorMessage = error?.message || "Failed to generate email";
          onProgress?.(index, new Error(errorMessage));
          return { error: errorMessage };
        }
      })
    )
  );

  return results;
}

// ============================================
// Trigger Detection
// ============================================

function buildTriggerDetectionPrompt(
  prospect: Prospect,
  companyData?: {
    websiteInfo?: string;
    recentNews?: Array<{ title: string; description: string; source: string; date: string }>;
  }
): string {
  const linkedinContext = prospect.linkedinUrl 
    ? `\nLinkedIn Profile: ${prospect.linkedinUrl}` 
    : "";
  
  const notesContext = prospect.notes 
    ? `\nAdditional Context: ${prospect.notes}` 
    : "";

  // Build company website context
  let websiteContext = "";
  if (companyData?.websiteInfo) {
    const truncatedWebsiteInfo = truncateIntelligently(companyData.websiteInfo, 2000);
    websiteContext = `\n\nCOMPANY WEBSITE DATA (use this for accurate, real information about the company):
${truncatedWebsiteInfo}${companyData.websiteInfo.length > 2000 ? "..." : ""}

This is REAL data from their website. Use it to create specific, accurate triggers about their products, services, and company focus.`;
  }

  // Build recent news context
  let newsContext = "";
  const hasRealNews = companyData?.recentNews && companyData.recentNews.length > 0;
  
  if (hasRealNews && companyData.recentNews) {
    const recentNews = companyData.recentNews;
    newsContext = `\n\n=== REAL NEWS ARTICLES ABOUT ${prospect.company} ===
CRITICAL: These are the ONLY real news articles available. You MUST create "news" type triggers ONLY from these actual articles. DO NOT invent, generate, or hallucinate additional news articles.

${recentNews.map((news, i) => 
  `${i + 1}. ${news.title}
   ${news.description}
   Source: ${news.source} | Date: ${news.date}`
).join("\n\n")}

IMPORTANT RULES FOR NEWS TRIGGERS:
- You may ONLY create "news" type triggers from the articles listed above
- Match the title, description, source, and date from the real news items
- DO NOT create any additional news triggers beyond what's listed above
- If you need more triggers, use other types: LinkedIn, company events, industry trends, job changes, or funding`;
  }

  const hasRealData = websiteContext || newsContext;
  
  // Build data guidance based on what's available
  let dataGuidance = "";
  if (hasRealNews) {
    dataGuidance = `🚨 CRITICAL INSTRUCTIONS 🚨
You have access to REAL news articles listed above. For "news" type triggers:
- You MUST ONLY use the real news articles provided
- DO NOT generate, invent, or hallucinate additional news articles
- Match the exact title, description, source, and date from the real articles
- If you need more triggers beyond the real news, use website data, LinkedIn activity, industry trends, job changes, or funding - but NEVER create fake news`;
  } else if (hasRealData) {
    dataGuidance = "IMPORTANT: You have access to REAL company data. Use this information to create SPECIFIC, ACCURATE triggers. Do NOT make up generic triggers when you have real data available.";
  } else {
    dataGuidance = "Note: No real-time data available. Generate realistic, plausible triggers based on the company name, industry, and prospect's role.";
  }

  // Build trigger generation instructions
  const triggerInstructions = hasRealNews
    ? `Generate triggers based on the REAL news articles provided above. For each real news item, create a corresponding "news" type trigger with matching title, description, source, and date. You may also create additional triggers from website data, LinkedIn activity, industry trends, job changes, or funding - but DO NOT create any additional fake news articles.`
    : `Generate 4-6 potential triggers. For each trigger, consider:`;

  const triggerTypes = hasRealNews
    ? `1. NEWS - ONLY use the real news articles listed above (${companyData.recentNews!.length} articles available). DO NOT create additional news triggers.
2. LINKEDIN - Posts, articles, profile updates, job changes
3. COMPANY_EVENT - Conferences, webinars, awards, partnerships
4. INDUSTRY_TREND - Market shifts, new regulations, emerging technologies
5. JOB_CHANGE - Promotions, new roles, team expansions
6. FUNDING - Investment rounds, acquisitions, financial milestones`
    : `1. NEWS - Company announcements, press releases, product launches, expansions
2. LINKEDIN - Posts, articles, profile updates, job changes
3. COMPANY_EVENT - Conferences, webinars, awards, partnerships
4. INDUSTRY_TREND - Market shifts, new regulations, emerging technologies
5. JOB_CHANGE - Promotions, new roles, team expansions
6. FUNDING - Investment rounds, acquisitions, financial milestones`;

  const finalWarning = hasRealNews
    ? `\n\n🚨 FINAL WARNING: For "news" type triggers, you MUST ONLY use the real news articles provided above. Match their exact titles, descriptions, sources, and dates. DO NOT create, generate, or hallucinate any additional news articles. If you need more triggers, use other trigger types.`
    : "";

  return `You are an expert sales researcher. Your job is to identify potential "triggers" - recent events or activities that could be used as personalized conversation starters in a cold email.

${dataGuidance}

PROSPECT INFORMATION:
Name: ${prospect.firstName} ${prospect.lastName}
Title: ${prospect.title}
Company: ${prospect.company}${linkedinContext}${notesContext}${websiteContext}${newsContext}

${triggerInstructions}

${triggerTypes}

Return a JSON object with:
{
  "triggers": [
    {
      "type": "news" | "linkedin" | "company_event" | "industry_trend" | "job_change" | "funding",
      "title": "Short, compelling title for the trigger${hasRealNews ? " (for news type, use the exact title from the real article)" : ""}",
      "description": "2-3 sentence description of the trigger and why it's relevant${hasRealNews ? " (for news type, use the exact description from the real article)" : ""}",
      "relevance": "high" | "medium" | "low",
      "source": "Where this might have been found${hasRealNews ? " (for news type, use the exact source from the real article)" : " (e.g., 'Company Blog', 'LinkedIn', 'TechCrunch', 'Press Release')"}",
      "date": "Approximate date${hasRealNews ? " (for news type, use the exact date from the real article)" : " (e.g., 'This week', 'November 2024', 'Recently')"}"
    }
  ],
  "prospectSummary": "Brief 2-3 sentence summary of who this prospect is and key insights about their role/company"
}

Make the triggers feel authentic and specific to this person/company. ${hasRealData ? "Base triggers on the REAL data provided above." : "Avoid generic triggers."}${finalWarning}
Prioritize triggers with higher relevance that would make great email openers.`;
}

export async function detectTriggers(
  prospect: Prospect,
  companyData?: {
    websiteInfo?: string;
    recentNews?: Array<{ title: string; description: string; source: string; date: string }>;
  }
): Promise<DetectTriggersResponse> {
  const prompt = buildTriggerDetectionPrompt(prospect, companyData);

  console.log("[AI] Starting trigger detection for:", prospect.firstName, prospect.lastName, "@", prospect.company);
  if (companyData?.websiteInfo) {
    console.log("[AI] Using company website data");
  }
  if (companyData?.recentNews && companyData.recentNews.length > 0) {
    console.log("[AI] Using", companyData.recentNews.length, "recent news items");
  }

  try {
    const model = useOpenRouter ? "openai/gpt-4o" : "gpt-4o";
    
    const { text } = await generateText({
      model: provider(model),
      prompt,
      maxOutputTokens: 2048,
    });
    
    if (!text) {
      console.error("[AI] No content in trigger detection response");
      throw new Error("No response from AI");
    }

    const jsonContent = extractJsonFromResponse(text);
    const parsed = JSON.parse(jsonContent.trim());
    
    // Valid trigger types that match our schema
    const validTypes = ["news", "linkedin", "company_event", "industry_trend", "job_change", "funding"] as const;
    const validRelevance = ["high", "medium", "low"] as const;
    
    // Add unique IDs to each trigger and validate types
    const triggersWithIds: DetectedTrigger[] = parsed.triggers
      .filter((trigger: any) => 
        validTypes.includes(trigger.type) && 
        validRelevance.includes(trigger.relevance)
      )
      .map((trigger: any) => ({
        id: nanoid(8),
        type: trigger.type,
        title: String(trigger.title || ""),
        description: String(trigger.description || ""),
        relevance: trigger.relevance,
        source: String(trigger.source || ""),
        date: trigger.date ? String(trigger.date) : undefined,
        selected: trigger.relevance === "high", // Auto-select high relevance triggers
      }));

    console.log("[AI] Detected", triggersWithIds.length, "triggers for:", prospect.firstName);
    
    return {
      triggers: triggersWithIds,
      prospectSummary: parsed.prospectSummary || "",
      companyData: companyData ? {
        websiteInfo: companyData.websiteInfo ? "Website data included" : undefined,
        recentNews: companyData.recentNews && companyData.recentNews.length > 0 
          ? `${companyData.recentNews.length} news items found` 
          : undefined,
      } : undefined,
    };
  } catch (error: any) {
    console.error("[AI] Trigger detection error:", error?.message || error);
    throw error;
  }
}

// ============================================
// Profile Extraction from Website
// ============================================

/**
 * Extract user profile information from website content using AI
 */
export async function extractProfileFromWebsite(
  websiteContent: string,
  companyName: string
): Promise<Partial<UserProfile>> {
  console.log("[AI] Extracting profile from website content for:", companyName);

  const prompt = `You are an expert at analyzing company websites and extracting key information for sales profiles.

Analyze the following website content from ${companyName} and extract relevant information to fill out a sales profile.

WEBSITE CONTENT:
${truncateIntelligently(websiteContent, 8000)}${websiteContent.length > 8000 ? "..." : ""}

Extract and structure the following information from the website content:

1. **Company Description**: A brief 2-3 sentence description of what the company does
2. **Industry**: The industry or sector the company operates in
3. **Product/Service Name**: Main product or service name
4. **Product Description**: What the product/service does and how it works
5. **Value Proposition**: The key benefit or outcome the product delivers
6. **Target Audience**: Who the product/service is for (job titles, company types, etc.)
7. **Pain Points**: Problems or challenges the product solves (if mentioned)
    // Return all fields, including empty strings or nulls if not present
    const profile: Partial<UserProfile> = {
      companyDescription: parsed.hasOwnProperty('companyDescription') ? parsed.companyDescription : null,
      industry: parsed.hasOwnProperty('industry') ? parsed.industry : null,
      productName: parsed.hasOwnProperty('productName') ? parsed.productName : null,
      productDescription: parsed.hasOwnProperty('productDescription') ? parsed.productDescription : null,
      valueProposition: parsed.hasOwnProperty('valueProposition') ? parsed.valueProposition : null,
      targetAudience: parsed.hasOwnProperty('targetAudience') ? parsed.targetAudience : null,
      painPoints: parsed.hasOwnProperty('painPoints') ? parsed.painPoints : null,
      differentiators: parsed.hasOwnProperty('differentiators') ? parsed.differentiators : null,
      socialProof: parsed.hasOwnProperty('socialProof') ? parsed.socialProof : null,
    };
  "painPoints": "string",
  "differentiators": "string",
  "socialProof": "string"
}

Be specific and extract actual information from the website. Do not make up information that isn't present in the content.`;

  try {
    const model = useOpenRouter ? "openai/gpt-4o" : "gpt-4o";
    
    const { text } = await generateText({
      model: provider(model),
      prompt,
      maxOutputTokens: 2048,
    });
    
    if (!text) {
      console.error("[AI] No content in profile extraction response");
      throw new Error("No response from AI");
    }

    const jsonContent = extractJsonFromResponse(text);
    const parsed = JSON.parse(jsonContent.trim());
    
    console.log("[AI] Successfully extracted profile information");
    
    // Return all fields that exist in the parsed response, including empty strings if explicitly set by AI
    // This distinguishes between fields that weren't found (undefined/not included) vs fields that were empty (empty string)
const profile: Partial<UserProfile> = {  
      companyDescription: parsed.hasOwnProperty('companyDescription') ? parsed.companyDescription : null,  
      industry: parsed.hasOwnProperty('industry') ? parsed.industry : null,  
      productName: parsed.hasOwnProperty('productName') ? parsed.productName : null,  
      productDescription: parsed.hasOwnProperty('productDescription') ? parsed.productDescription : null,  
      valueProposition: parsed.hasOwnProperty('valueProposition') ? parsed.valueProposition : null,  
      targetAudience: parsed.hasOwnProperty('targetAudience') ? parsed.targetAudience : null,  
      painPoints: parsed.hasOwnProperty('painPoints') ? parsed.painPoints : null,  
      differentiators: parsed.hasOwnProperty('differentiators') ? parsed.differentiators : null,  
      socialProof: parsed.hasOwnProperty('socialProof') ? parsed.socialProof : null,  
    };  
    
    return profile;
  } catch (error: any) {
    console.error("[AI] Profile extraction error:", error?.message || error);
    throw error;
  }
}
