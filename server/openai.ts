import OpenAI from "openai";
import type { Prospect, GeneratedEmail, UserProfile, DetectedTrigger, DetectTriggersResponse } from "@shared/schema";
import { storage } from "./storage";
import { nanoid } from "nanoid";

// Check for user's own OpenAI API key first, fall back to Replit AI Integrations
const useOwnKey = !!process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  baseURL: useOwnKey ? "https://api.openai.com/v1" : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: useOwnKey ? process.env.OPENAI_API_KEY : process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

console.log(`[OpenAI] Using ${useOwnKey ? "your own OpenAI API key" : "Replit AI Integrations"}`);

interface EmailGenerationOptions {
  prospect: Prospect;
  tone: "casual" | "professional" | "hyper-personal";
  length: "short" | "medium";
  profile?: UserProfile;
  triggers?: DetectedTrigger[];
}

function buildPrompt(options: EmailGenerationOptions): string {
  const { prospect, tone, length, profile, triggers } = options;
  
  const toneInstructions = {
    casual: "Write in a friendly, conversational tone. Use contractions and casual language.",
    professional: "Write in a polished, professional tone. Be respectful and business-appropriate.",
    "hyper-personal": "Write in an extremely personalized way. Reference specific details about their role, company, and any context provided. Make it feel like you know them.",
  };

  const lengthInstructions = {
    short: "Keep the email concise - no more than 3-4 sentences in the body. Get straight to the point.",
    medium: "Write a moderate-length email - about 4-6 sentences in the body. Include enough context but stay focused.",
  };

  const linkedinContext = prospect.linkedinUrl 
    ? `\nLinkedIn Profile: ${prospect.linkedinUrl}` 
    : "";
  
  const notesContext = prospect.notes 
    ? `\nAdditional Context: ${prospect.notes}` 
    : "";

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
Email: ${prospect.email}${linkedinContext}${notesContext}${triggerContext}${senderContext}

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

export async function generateEmail(options: Omit<EmailGenerationOptions, 'profile'> & { triggers?: DetectedTrigger[] }): Promise<GeneratedEmail> {
  // Fetch user profile to include in the prompt
  const profile = await storage.getUserProfile();
  const optionsWithProfile: EmailGenerationOptions = { ...options, profile, triggers: options.triggers };
  
  const prompt = buildPrompt(optionsWithProfile);

  console.log("[OpenAI] Starting email generation for:", options.prospect.firstName, options.prospect.lastName);
  console.log("[OpenAI] Profile loaded:", profile.senderName ? `${profile.senderName} @ ${profile.companyName}` : "No profile set");
  console.log("[OpenAI] Using:", useOwnKey ? "Your OpenAI API key" : "Replit AI Integrations");

  try {
    const response = await openai.chat.completions.create({
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    console.log("[OpenAI] Response received, choices:", response.choices?.length);

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      console.error("[OpenAI] No content in response:", JSON.stringify(response, null, 2));
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    console.log("[OpenAI] Successfully parsed email for:", options.prospect.firstName);
    
    return {
      subject: parsed.subject,
      body: parsed.body,
    };
  } catch (error: any) {
    console.error("[OpenAI] Error:", error?.message || error);
    console.error("[OpenAI] Full error:", JSON.stringify(error, null, 2));
    throw error;
  }
}

// Batch processing with rate limiting
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

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

function buildTriggerDetectionPrompt(prospect: Prospect): string {
  const linkedinContext = prospect.linkedinUrl 
    ? `\nLinkedIn Profile: ${prospect.linkedinUrl}` 
    : "";
  
  const notesContext = prospect.notes 
    ? `\nAdditional Context: ${prospect.notes}` 
    : "";

  return `You are an expert sales researcher. Your job is to identify potential "triggers" - recent events or activities that could be used as personalized conversation starters in a cold email.

Analyze the following prospect and their company. Generate realistic, plausible triggers based on what you know about:
- The company and its industry
- Common activities for someone in their role
- Recent trends in their sector
- Typical events for companies of this type

PROSPECT INFORMATION:
Name: ${prospect.firstName} ${prospect.lastName}
Title: ${prospect.title}
Company: ${prospect.company}${linkedinContext}${notesContext}

Generate 4-6 potential triggers. For each trigger, consider:
1. NEWS - Company announcements, press releases, product launches, expansions
2. LINKEDIN - Posts, articles, profile updates, job changes
3. COMPANY_EVENT - Conferences, webinars, awards, partnerships
4. INDUSTRY_TREND - Market shifts, new regulations, emerging technologies
5. JOB_CHANGE - Promotions, new roles, team expansions
6. FUNDING - Investment rounds, acquisitions, financial milestones

Return a JSON object with:
{
  "triggers": [
    {
      "type": "news" | "linkedin" | "company_event" | "industry_trend" | "job_change" | "funding",
      "title": "Short, compelling title for the trigger",
      "description": "2-3 sentence description of the trigger and why it's relevant",
      "relevance": "high" | "medium" | "low",
      "source": "Where this might have been found (e.g., 'Company Blog', 'LinkedIn', 'TechCrunch', 'Press Release')",
      "date": "Approximate date (e.g., 'This week', 'November 2024', 'Recently')"
    }
  ],
  "prospectSummary": "Brief 2-3 sentence summary of who this prospect is and key insights about their role/company"
}

Make the triggers feel authentic and specific to this person/company. Avoid generic triggers.
Prioritize triggers with higher relevance that would make great email openers.`;
}

export async function detectTriggers(prospect: Prospect): Promise<DetectTriggersResponse> {
  const prompt = buildTriggerDetectionPrompt(prospect);

  console.log("[OpenAI] Starting trigger detection for:", prospect.firstName, prospect.lastName, "@", prospect.company);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      console.error("[OpenAI] No content in trigger detection response");
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    // Add unique IDs to each trigger
    const triggersWithIds: DetectedTrigger[] = parsed.triggers.map((trigger: any) => ({
      ...trigger,
      id: nanoid(8),
      selected: trigger.relevance === "high", // Auto-select high relevance triggers
    }));

    console.log("[OpenAI] Detected", triggersWithIds.length, "triggers for:", prospect.firstName);
    
    return {
      triggers: triggersWithIds,
      prospectSummary: parsed.prospectSummary || "",
    };
  } catch (error: any) {
    console.error("[OpenAI] Trigger detection error:", error?.message || error);
    throw error;
  }
}
