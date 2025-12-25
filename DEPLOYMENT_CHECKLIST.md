
## Critical issues found

### 1. Hallucination bug — trigger detection
Problem: The LLM generates fake news articles even when Firecrawl provides real data.

Fix: Update the prompt to only use real Firecrawl data when available.

### 2. Security bug — scheduler
Problem: `scheduler.ts` calls `getAllProspects()` which returns prospects from all users, causing cross-user data access.

Location: `server/scheduler.ts` lines 77 and 168

### 3. Missing subscription tier tracking
Problem: No database fields for subscription tiers (free/pro/enterprise) or email limits.

### 4. Production deployment issues
- No rate limiting middleware
- Memory-based session store (not production-ready)
- No request size limits
- No CORS configuration
- Error handling could expose sensitive info
- No database connection pool limits
- Missing environment variable validation

## Fixes

### Fix 1: Hallucination issue — enforce real data only

```typescript:server/openai.ts
// ... existing code ...

function buildTriggerDetectionPrompt(
  prospect: Prospect,
  companyData?: {
    websiteInfo?: string;
    recentNews?: Array<{ title: string; description: string; source: string; date: string }>;
  }
): string {
  // ... existing code for linkedinContext, notesContext, websiteContext ...

  // Build recent news context
  let newsContext = "";
  if (companyData?.recentNews && companyData.recentNews.length > 0) {
    newsContext = `\n\nRECENT NEWS ABOUT ${prospect.company} (ONLY use these REAL news items - DO NOT create additional fake news):
${companyData.recentNews.map((news, i) => 
  `${i + 1}. ${news.title}
   ${news.description}
   Source: ${news.source} | Date: ${news.date}`
).join("\n\n")}

CRITICAL: These are the ONLY real news articles available. You MUST create triggers ONLY from these actual news items. DO NOT invent or generate additional news articles. If you need more triggers, use the website data or other trigger types (LinkedIn, industry trends, etc.), but NEVER create fake news articles.`;
  }

  const hasRealData = websiteContext || newsContext;
  const hasRealNews = companyData?.recentNews && companyData.recentNews.length > 0;
  
  const dataGuidance = hasRealData 
    ? hasRealNews
      ? "CRITICAL INSTRUCTIONS: You have access to REAL company data and REAL news articles listed above. You MUST create triggers ONLY from the real news items provided. DO NOT generate, invent, or hallucinate additional news articles. If you need more triggers beyond the real news, use website data, LinkedIn activity, industry trends, or other trigger types - but NEVER create fake news."
      : "IMPORTANT: You have access to REAL company data. Use this information to create SPECIFIC, ACCURATE triggers. Do NOT make up generic triggers when you have real data available."
    : "Note: No real-time data available. Generate realistic, plausible triggers based on the company name, industry, and prospect's role.";

  return `You are an expert sales researcher. Your job is to identify potential "triggers" - recent events or activities that could be used as personalized conversation starters in a cold email.

${dataGuidance}

PROSPECT INFORMATION:
Name: ${prospect.firstName} ${prospect.lastName}
Title: ${prospect.title}
Company: ${prospect.company}${linkedinContext}${notesContext}${websiteContext}${newsContext}

${hasRealNews 
  ? `Generate triggers based on the REAL news articles provided above. For each real news item, create a corresponding trigger. You may also create additional triggers from website data, LinkedIn activity, or industry trends, but DO NOT create any additional fake news articles.`
  : `Generate 4-6 potential triggers. For each trigger, consider:`
}

1. NEWS - ${hasRealNews ? "ONLY use the real news articles listed above" : "Company announcements, press releases, product launches, expansions"}
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

${hasRealNews 
  ? "CRITICAL: For 'news' type triggers, ONLY use the real news articles provided above. Match the title, description, source, and date from the real news items. DO NOT create additional news triggers."
  : "Make the triggers feel authentic and specific to this person/company."
} Prioritize triggers with higher relevance that would make great email openers.`;
}
```

### Fix 2: Scheduler security bug

```typescript:server/scheduler.ts
// ... existing code ...

async function processEmail(scheduledEmail: ScheduledEmailRecord): Promise<void> {
  // Mark as sending
  await storage.updateScheduledEmailStatus(scheduledEmail.id, "sending");

  // Check if SendGrid is configured
  if (!isSendGridConfigured()) {
    console.log(`[Scheduler] Email ${scheduledEmail.id} - SendGrid not configured, marking as failed`);
    await storage.updateScheduledEmailStatus(scheduledEmail.id, "failed", "SendGrid not configured");
    return;
  }

  // Get prospect for recipient email - FIX: Get prospect by ID with userId check
  const prospect = await storage.getProspectById(scheduledEmail.prospectId);
  
  if (!prospect) {
    await storage.updateScheduledEmailStatus(scheduledEmail.id, "failed", "Prospect not found");
    return;
  }

  // Get user profile for sender info (using userId from prospect)
  const profile = await storage.getUserProfile(prospect.userId);
  
  // ... rest of the function ...
}

// ... existing code ...

async function scheduleStepEmail(
  enrollmentId: number,
  prospectId: number,
  sequenceId: number,
  step: SequenceStepRecord
): Promise<void> {
  // Get sequence for tone/length settings (internal use - no userId check)
  const sequence = await storage.getSequenceById(sequenceId);
  if (!sequence) return;

  // FIX: Get prospect by ID instead of all prospects
  const prospectRecord = await storage.getProspectById(prospectId);
  
  if (!prospectRecord) {
    console.error(`[Scheduler] Prospect ${prospectId} not found`);
    return;
  }

  // ... rest of the function ...
}
```

Add to `server/storage.ts`:

```typescript:server/storage.ts
// ... existing code ...

async getProspectById(id: number): Promise<ProspectRecord | null> {
  const result = await db.select()
    .from(prospects)
    .where(eq(prospects.id, id))
    .limit(1);
  
  return result[0] || null;
}

// ... existing code ...
```

### Fix 3: Database schema — subscription tiers

```typescript:shared/schema.ts
// ... existing code ...

// Add subscription tier enum
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "pro", "enterprise"]);

// Update userProfiles table
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  // ... existing fields ...
  
  // NEW: Subscription fields
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("free"),
  emailsUsedThisMonth: integer("emails_used_this_month").notNull().default(0),
  emailsUsedThisMonthResetAt: timestamp("emails_used_this_month_reset_at").defaultNow().notNull(),
  subscriptionStartsAt: timestamp("subscription_starts_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add helper functions for limits
export const SUBSCRIPTION_LIMITS = {
  free: {
    emailsPerMonth: 50,
    bulkCampaigns: 1,
    sequences: 1,
  },
  pro: {
    emailsPerMonth: 1000,
    bulkCampaigns: 10,
    sequences: 10,
  },
  enterprise: {
    emailsPerMonth: 10000,
    bulkCampaigns: -1, // unlimited
    sequences: -1, // unlimited
  },
} as const;

// ... existing code ...
```

### Fix 4: Production deployment checklist

Create `DEPLOYMENT_CHECKLIST.md`:

```markdown:DEPLOYMENT_CHECKLIST.md
<code_block_to_apply_changes_from>
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
FIRECRAWL_API_KEY=fc-...
SENDGRID_API_KEY=SG...
CLERK_SECRET_KEY=sk_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...
NODE_ENV=production
PORT=3000
SESSION_SECRET=<generate-secure-random>
REDIS_URL=redis://...
PERPLEXITY_API_KEY=pplx-... (for future)
```

## Post-Deployment

- [ ] Test all critical flows
- [ ] Monitor error logs
- [ ] Check database connections
- [ ] Verify email sending
- [ ] Test authentication
- [ ] Load testing
```

## Next steps

1. Fix the hallucination bug (prompt update)
2. Fix the scheduler security bug
3. Add subscription tier schema
4. Add Perplexity integration
5. Add production hardening (rate limiting, error handling, etc.)

Should I:
1. Implement the hallucination fix now?
2. Fix the scheduler security bug?
3. Add the subscription tier schema changes?
4. Create a Perplexity integration file?
5. Add production middleware (rate limiting, CORS, etc.)?

