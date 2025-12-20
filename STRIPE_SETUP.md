# Stripe Setup Guide

This guide explains how to configure Stripe for the AI Sales Email Generator SaaS.

## Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...      # or sk_live_... for production
STRIPE_PRO_PRICE_ID=price_...       # Your Pro plan Price ID
STRIPE_WEBHOOK_SECRET=whsec_...     # Webhook signing secret
```

## Step-by-Step Setup

### 1. Get Your API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** > **API keys**
3. Copy the **Secret key**:
   - Use `sk_test_...` for development/testing
   - Use `sk_live_...` for production

### 2. Create Your Product and Price

1. Go to **Products** in Stripe Dashboard
2. Click **Add product**
3. Configure your Pro plan:
   - **Name**: "Pro Plan" (or your preferred name)
   - **Description**: "1000 emails/month, advanced features"
   - **Pricing**: Set your monthly price (e.g., $29/month)
   - **Billing period**: Monthly (recurring)
4. After creating, copy the **Price ID** (starts with `price_`)

### 3. Using an Existing Payment Link

If you already have a payment link (like `plink_1SgYefKa79bPhGM4uGU0XGiO`):

**Option A: Extract Price ID from Payment Link (Recommended)**
1. Go to **Payment links** in Stripe Dashboard
2. Find your payment link and click to view details
3. Look at the **Products** section
4. Click on the product to see its Price ID
5. Copy the Price ID (starts with `price_`) for `STRIPE_PRO_PRICE_ID`

**Option B: Use the Payment Link URL Directly**
If you prefer to use the payment link directly instead of Stripe Checkout:
1. Get the public URL of your payment link (e.g., `https://buy.stripe.com/...`)
2. You can link to this directly in your app
3. Note: Webhooks will still update subscription status, but you'll have less control over metadata

**For this app, we recommend Option A** (extracting the Price ID) because:
- Checkout sessions include user metadata for proper subscription tracking
- Success/cancel URLs are customized for the app
- Better integration with the existing webhook handler

**Finding the Price ID from your payment link:**
1. Open Stripe Dashboard > Payment links
2. Click on your payment link
3. Under "Products", you'll see the product and price
4. Click on the price amount to go to the product page
5. In the Pricing section, copy the "API ID" (e.g., `price_1SgYefKa79bPhGM4...`)

### 4. Set Up Webhooks

Webhooks notify your app when payments succeed, subscriptions change, etc.

#### For Local Development:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copy the webhook signing secret (shown in terminal)
5. Set `STRIPE_WEBHOOK_SECRET` to this value

#### For Production:

1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (click to reveal)
7. Set `STRIPE_WEBHOOK_SECRET` to this value

## Testing

### Test Mode vs Live Mode

- **Test mode**: Use `sk_test_...` keys, no real charges
- **Live mode**: Use `sk_live_...` keys, real money

### Test Card Numbers

Use these in test mode:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Payment declined |
| `4000 0000 0000 0341` | Attach fails |

Use any future expiry date and any 3-digit CVC.

### Testing Webhooks Locally

1. Start your server: `npm run dev`
2. In another terminal, run:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
3. Trigger test events:
   ```bash
   # Test checkout completion
   stripe trigger checkout.session.completed

   # Test subscription update
   stripe trigger customer.subscription.updated

   # Test subscription cancellation
   stripe trigger customer.subscription.deleted
   ```

### Testing the Full Flow

1. Start your app in test mode
2. Go to Settings page
3. Click "Upgrade to Pro"
4. Complete checkout with test card `4242 4242 4242 4242`
5. Verify:
   - Redirected back to Settings with success message
   - Subscription shows as "Pro"
   - Email limits increased to 1000/month

## Subscription Tiers

| Tier | Emails/Month | Bulk Campaigns | Sequences |
|------|--------------|----------------|-----------|
| Free | 50 | 1 | 1 |
| Pro | 1,000 | 10 | 10 |
| Enterprise | 10,000 | Unlimited | Unlimited |

## Free Trial

New users automatically receive a 14-day free trial with Pro features:

- Full Pro tier access during trial
- After 14 days, downgrades to Free tier
- Users can upgrade anytime during or after trial

## Troubleshooting

### "Stripe not configured" error

Check that all three environment variables are set:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

### Webhooks not working

1. Verify webhook endpoint is accessible
2. Check the signing secret matches
3. Look at webhook logs in Stripe Dashboard > Developers > Webhooks
4. Check your server logs for webhook errors

### "Raw body not available" error

The Express server needs raw body for webhook verification. This is configured in `server/index.ts`:
```typescript
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
```

### Payment succeeds but subscription not updated

1. Check webhook is receiving events (Stripe Dashboard > Webhooks)
2. Verify `userId` is in checkout session metadata
3. Check server logs for webhook processing errors

## Customer Portal

Users can manage their subscription via Stripe's Customer Portal:

1. Go to Settings page while subscribed
2. Click "Manage Subscription"
3. Users can:
   - Update payment method
   - Cancel subscription
   - View invoice history

To customize the portal, go to **Settings** > **Customer portal** in Stripe Dashboard.

