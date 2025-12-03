import OpenAI from "openai";
import type { Prospect, GeneratedEmail } from "@shared/schema";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface EmailGenerationOptions {
  prospect: Prospect;
  tone: "casual" | "professional" | "hyper-personal";
  length: "short" | "medium";
}

function buildPrompt(options: EmailGenerationOptions): string {
  const { prospect, tone, length } = options;
  
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

  return `You are an expert sales copywriter specializing in Basho-style cold outreach emails. Basho emails are highly personalized, pattern-interrupt emails that demonstrate genuine research about the prospect and create curiosity.

Generate a personalized cold sales email for the following prospect:

Name: ${prospect.firstName} ${prospect.lastName}
Title: ${prospect.title}
Company: ${prospect.company}
Email: ${prospect.email}${linkedinContext}${notesContext}

TONE: ${toneInstructions[tone]}

LENGTH: ${lengthInstructions[length]}

BASHO EMAIL PRINCIPLES:
1. Start with a personalized observation or compliment about them, their company, or recent achievements
2. Create curiosity without being manipulative
3. Keep it about THEM, not you or your product
4. End with a soft, low-commitment call to action (suggest specific times)
5. Be conversational and human - avoid corporate jargon
6. Never use generic phrases like "I hope this email finds you well"

Return your response as a JSON object with two fields:
- "subject": A compelling, personalized subject line (max 60 characters, no generic phrases)
- "body": The email body text (use \\n for line breaks)

The email should be signed with just "Best," followed by "Alex" (no full name or title).`;
}

export async function generateEmail(options: EmailGenerationOptions): Promise<GeneratedEmail> {
  const prompt = buildPrompt(options);

  console.log("[OpenAI] Starting email generation for:", options.prospect.firstName, options.prospect.lastName);
  console.log("[OpenAI] Base URL:", process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? "configured" : "MISSING");
  console.log("[OpenAI] API Key:", process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "configured" : "MISSING");

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
