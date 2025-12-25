# Basho Studio - AI Sales Email Generator

Basho Studio is a full-stack AI-powered sales email generator designed for personalized, Basho-style cold outreach. The application enables users to generate highly customized sales emails either for individual prospects or in bulk campaigns, leveraging AI-powered copywriting to create compelling, pattern-interrupt emails that follow the Basho methodology.

## Features

- **Single Prospect Email Generation** - Real-time AI assistance for creating personalized emails
- **Bulk Campaign Management** - CSV upload with batch processing for multiple prospects
- **AI-Driven Personalization** - OpenAI-compatible models for intelligent email generation
- **Email Sequences** - Multi-step automated email campaigns with configurable delays
- **CRM Integration** - HubSpot integration for contact sync and activity logging
- **Email Delivery** - SendGrid integration for sending generated emails
- **Modern UI** - Dark-themed B2B SaaS interface optimized for productivity

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** as the build tool and development server
- **Wouter** for lightweight client-side routing
- **TanStack React Query** for server state management
- **Radix UI** + **shadcn/ui** for accessible UI components
- **Tailwind CSS** for utility-first styling

### Backend
- **Node.js** with **Express.js**
- **TypeScript** for type safety
- **Drizzle ORM** with PostgreSQL (Neon Database)
- **Zod** for runtime schema validation

### External Services
- **OpenAI API** - GPT-4o for email generation
- **SendGrid** - Email delivery
- **HubSpot** - CRM integration (optional)
- **Clerk** - Authentication (optional)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- PostgreSQL database (Neon recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd AISalesEmailGen
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and fill in your values
   ```
   See [Configuration](#configuration) below and `.env.example` for all available options.

4. Push the database schema:
   ```bash
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

## Configuration

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required values in `.env`

See `.env.example` for a complete list of all available configuration options with descriptions.

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Neon recommended) |

### AI Configuration (One Required)

The application requires one of the following AI configurations:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key (recommended) |

**OR** (Replit-specific fallback):

| Variable | Description |
|----------|-------------|
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI integration base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI integration API key |

> **Note:** If `OPENAI_API_KEY` is set, it takes precedence over Replit AI Integrations. The Replit fallback is automatically configured when running on Replit and requires no manual setup.

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `FIRECRAWL_API_KEY` | FireCrawl API key for web scraping and company research |
| `SENDGRID_API_KEY` | SendGrid API key for email delivery |
| `HUBSPOT_API_KEY` | HubSpot API key for CRM integration |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for authentication |
| `CLERK_SECRET_KEY` | Clerk secret key for authentication |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push database schema changes |

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   └── pages/          # Page components
├── server/                 # Backend Express server
│   ├── routes.ts           # API route handlers
│   ├── openai.ts           # AI integration service
│   ├── sendgrid.ts         # Email delivery service
│   ├── hubspot.ts          # HubSpot CRM integration
│   ├── storage.ts          # Database storage layer
│   └── scheduler.ts        # Email scheduling service
├── shared/                 # Shared code between client and server
│   └── schema.ts           # Database schema and Zod validators
└── package.json
```

## API Endpoints

### Email Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate-email` | Generate a single personalized email |
| `POST` | `/api/generate-emails-bulk` | Generate emails for multiple prospects |
| `POST` | `/api/send-email` | Send an email via SendGrid |

### User Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profile` | Get user profile data |
| `POST` | `/api/profile` | Save/update user profile |

### Email Sequences

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sequences` | List all sequences |
| `POST` | `/api/sequences` | Create a new sequence |
| `GET` | `/api/sequences/:id` | Get sequence with steps |
| `PATCH` | `/api/sequences/:id` | Update a sequence |
| `PATCH` | `/api/sequences/:id/status` | Change sequence status |
| `DELETE` | `/api/sequences/:id` | Delete a sequence |

### CRM Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/crm/connections` | Get all CRM connections |
| `POST` | `/api/crm/hubspot/connect` | Connect to HubSpot |
| `POST` | `/api/crm/hubspot/sync` | Sync contacts from HubSpot |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Check service status |

## Email Generation Parameters

### Tone Options
- `casual` - Friendly, informal tone
- `professional` - Business-appropriate tone
- `hyper-personal` - Highly personalized, research-driven tone

### Length Options
- `short` - 3-4 sentences
- `medium` - 4-6 sentences

## SendGrid Setup

1. Create a SendGrid account at https://sendgrid.com
2. Go to Settings > API Keys and create a new API key with "Mail Send" permissions
3. Add the `SENDGRID_API_KEY` environment variable
4. Verify a sender email in SendGrid (Settings > Sender Authentication)

## HubSpot Integration

1. Create a HubSpot account
2. Generate a Private App with CRM scopes
3. Add the `HUBSPOT_API_KEY` environment variable
4. Use the Integrations page to connect and sync contacts

## FireCrawl Integration (Optional)

FireCrawl enables web scraping and company research features:

1. Create a FireCrawl account at https://firecrawl.dev
2. Get your API key from the dashboard
3. Add the `FIRECRAWL_API_KEY` environment variable
4. Features enabled:
   - **Prospect Research**: Automatically scrapes company websites and searches for recent news when detecting triggers
   - **Profile Auto-fill**: Crawls your company website to automatically populate profile fields

## Clerk Authentication (Optional)

1. Create a Clerk account at https://clerk.com
2. Create a new application in Clerk dashboard
3. Add `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` environment variables
4. Wrap routes with `<ProtectedRoute>` component to enable authentication

## Production Deployment

For production deployment instructions, see:
- **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** - Complete deployment guide
- **[SECURITY.md](./SECURITY.md)** - Security best practices and checklist
- **[STRIPE_SETUP.md](./STRIPE_SETUP.md)** - Stripe payment configuration

### Quick Production Checklist

- [ ] Set all required environment variables
- [ ] Use production API keys (not test keys)
- [ ] Configure Stripe with live mode
- [ ] Set up SSL certificate (HTTPS)
- [ ] Configure session storage (Redis or PostgreSQL)
- [ ] Enable rate limiting
- [ ] Run security audit: `npm audit`
- [ ] Test all critical flows

## Subscription Tiers

| Tier | Emails/Month | Price | Features |
|------|--------------|-------|----------|
| **Starter** | 50 | Free | Basic features, community support |
| **Pro** | 1,000 | $19.99/month | Bulk campaigns, sequences, priority support |
| **Enterprise** | Unlimited | Custom | Custom AI training, SSO, dedicated support |

### Free Trial

New users automatically receive a **14-day free trial** with full Pro tier access:
- 1,000 emails per month during trial
- All Pro features unlocked
- No credit card required
- Automatically downgrades to Free tier after 14 days

## Development

### Environment

- Node.js 18+ required
- PostgreSQL database (Neon recommended)
- npm for package management

### Development Workflow

1. Make changes to code
2. TypeScript will auto-compile in dev mode
3. Vite will hot-reload client changes
4. Server restarts automatically with tsx

### Type Checking

```bash
npm run check
```

### Database Changes

After modifying `shared/schema.ts`:
```bash
npm run db:push
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run check` to verify types
5. Submit a pull request

## License

MIT

## Support

For issues or questions:
- Email: hello@bashostudio.com
- Check existing documentation first
- Review security practices in [SECURITY.md](./SECURITY.md)
