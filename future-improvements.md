Great question! Let me look at what you currently have to give you targeted recommendations.

[5 tools called]

Great question! You have a solid foundation. Here's what you'd need to scale to production:

---

## Current State vs Production Needs

| Area | Current | Production Need |
|------|---------|-----------------|
| **Job processing** | In-process with `p-limit(2)` | Dedicated job queue (BullMQ + Redis) |
| **Scheduler** | In-memory `setInterval` | Persistent, distributed scheduler |
| **Billing** | None | Stripe subscriptions + usage metering |
| **Email delivery** | SendGrid only | Multi-provider + warming + deliverability |
| **Concurrency** | 2 parallel AI calls | Dynamic based on tier (5-50+) |
| **Database** | Neon serverless | Same, but add connection pooling |

---

## Recommended Architecture Changes

### 1. **Job Queue System** (Critical)

Replace in-process batch generation with **BullMQ + Redis**:

```typescript
// New structure
server/
  jobs/
    queue.ts          // BullMQ setup
    workers/
      emailGenerator.worker.ts   // AI generation worker
      emailSender.worker.ts      // Send worker
    processors/
      bulkImport.processor.ts    // CSV processing
```

**Why:** Your current `generateEmailsBatch` runs in the request thread. 500 emails = 250+ seconds blocking. A queue lets you:

- Return immediately to the user
- Process in background workers
- Survive server restarts
- Scale workers horizontally

### 2. **Billing & Tiers** (Stripe)

Add to schema:

```typescript
// shared/schema.ts
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  tier: text("tier").notNull().default("free"), // 'free', 'starter', 'pro', 'enterprise'
  emailsPerMonth: integer("emails_per_month").notNull().default(50),
  emailsUsedThisMonth: integer("emails_used_this_month").notNull().default(0),
  concurrencyLimit: integer("concurrency_limit").notNull().default(2),
  billingCycleStart: timestamp("billing_cycle_start"),
  status: text("status").notNull().default("active"),
});
```

**Tier example:**

| Tier | Emails/mo | AI Concurrency | Send Rate |
|------|-----------|----------------|-----------|
| Free | 50 | 2 | 10/hr |
| Starter ($29) | 500 | 5 | 100/hr |
| Pro ($99) | 5,000 | 15 | 500/hr |
| Enterprise | Unlimited | 50 | Custom |

### 3. **Concurrent AI Generation with User Rate Control**

Enhance `openai.ts`:

```typescript
export async function generateEmailsBatch(
  prospects: ProspectInput[],
  options: {
    concurrency: number;        // From user's tier
    sendRate?: number;          // Emails per hour (user preference)
    onProgress: (progress: BatchProgress) => void;
  }
): Promise<BatchResult> {
  const limit = pLimit(options.concurrency);
  
  // Stagger if user wants controlled send rate
  const delayBetween = options.sendRate 
    ? Math.ceil(3600000 / options.sendRate) // ms between emails
    : 0;
  
  // Process with tier-based concurrency
  const results = await Promise.all(
    prospects.map((p, i) => limit(async () => {
      if (delayBetween && i > 0) {
        await delay(delayBetween * i);
      }
      return generateWithRetry(p);
    }))
  );
  
  return results;
}
```

### 4. **Bulk Import Flow**

```
User uploads CSV
       ↓
[API] Validate & store in temp table → Return job ID immediately
       ↓
[Queue] BullMQ job picks up import
       ↓
[Worker] For each prospect:
   1. Validate/dedupe
   2. Generate AI email (respecting concurrency limit)
   3. Queue for sending OR schedule based on user preference
       ↓
[WebSocket/Polling] Real-time progress to frontend
```

### 5. **Database Additions**

```typescript
// Bulk campaign jobs
export const bulkCampaignJobs = pgTable("bulk_campaign_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull(), // 'pending', 'processing', 'completed', 'failed'
  totalProspects: integer("total_prospects").notNull(),
  processedCount: integer("processed_count").default(0),
  successCount: integer("success_count").default(0),
  failedCount: integer("failed_count").default(0),
  sendMode: text("send_mode").notNull(), // 'immediate', 'scheduled', 'drip'
  sendRate: integer("send_rate"), // emails per hour if drip
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 6. **Infrastructure Stack**

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel / Railway                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Next.js   │  │   Express   │  │  BullMQ Workers │  │
│  │   Frontend  │  │     API     │  │  (background)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │               │                   │
           ▼               ▼                   ▼
    ┌──────────┐    ┌──────────┐       ┌──────────┐
    │  Neon    │    │  Upstash │       │  OpenAI  │
    │ Postgres │    │  Redis   │       │ /OpenRouter│
    └──────────┘    └──────────┘       └──────────┘
           │
           ▼
    ┌──────────┐    ┌──────────┐
    │  Stripe  │    │ SendGrid │
    │ Billing  │    │ + Resend │
    └──────────┘    └──────────┘
```

---

## Priority Order

1. **Add Redis + BullMQ** — Unblocks everything else
2. **Add Stripe billing** — Start monetizing
3. **Usage tracking middleware** — Enforce limits
4. **WebSocket/SSE progress** — Better UX for bulk ops
5. **Multi-email-provider fallback** — Deliverability
6. **Monitoring (Sentry, PostHog)** — Production visibility

Would you like me to dive deeper into any of these areas, or should I outline specific implementation steps for one of them?
