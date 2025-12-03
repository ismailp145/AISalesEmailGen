# Basho Studio - AI Sales Email Generator

## Overview

Basho Studio is a full-stack AI-powered sales email generator designed for personalized, Basho-style cold outreach. The application enables users to generate highly customized sales emails either for individual prospects or in bulk campaigns, leveraging LinkedIn enrichment signals and AI-powered copywriting to create compelling, pattern-interrupt emails that follow the Basho methodology (personalized trigger hooks, Consequence of Inaction statements, and specific CTAs).

**Core Capabilities:**
- Single prospect email generation with real-time AI assistance
- Bulk campaign management via CSV upload with batch processing
- AI-driven personalization using OpenAI-compatible models
- LinkedIn profile context integration (mock implementation, extensible for real enrichment)
- Email preview, editing, and management workflow
- Modern dark-themed B2B SaaS interface optimized for productivity

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack React Query for server state management and API caching
- React Hook Form with Zod validation for form handling

**UI Component System:**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library with custom dark theme
- Tailwind CSS for utility-first styling with custom design tokens
- Class Variance Authority (CVA) for component variant management

**Design System:**
- Dark-first theme with high contrast (#000000 background, #FFFFFF foreground)
- Single accent color (#00D1FF cyan) for CTAs and highlights
- System-based approach prioritizing information density and workflow efficiency
- Component library built on Radix UI ensuring accessibility compliance

**State Management:**
- React Query for API data fetching, caching, and synchronization
- Local React state for UI interactions and transient data
- No global state management library (Context API used sparingly)

**Routing Structure:**
- `/` - Single Email generation page
- `/bulk` - Bulk campaign management page
- `/settings` - My Profile page (user/company settings for AI personalization)

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js for HTTP server
- TypeScript for type safety across the codebase
- ESBuild for production bundling with allowlist-based dependency optimization

**API Design:**
- RESTful endpoints following resource-oriented patterns
- JSON request/response format
- Zod schema validation for request payloads

**Core API Endpoints:**
- `POST /api/generate-email` - Single prospect email generation (automatically uses user profile for context)
- `POST /api/generate-emails-bulk` - Batch email generation for multiple prospects
- `GET /api/profile` - Retrieve user profile data
- `POST /api/profile` - Save/update user profile data
- `POST /api/send-email` - Send generated email via SendGrid
- Static file serving for built frontend assets

**Service Layer Architecture:**
- `server/openai.ts` - AI integration service for email generation using OpenAI-compatible API
- `server/storage.ts` - In-memory data storage abstraction with interface-based design (IStorage)
- `server/routes.ts` - API route handlers with request validation

**AI Integration Strategy:**
- Uses Replit's AI Integrations service (OpenAI-compatible API)
- Centralized prompt engineering with customizable tone and length parameters
- Support for three tone variations: casual, professional, hyper-personal
- Two length options: short (3-4 sentences), medium (4-6 sentences)
- AI prompt dynamically incorporates user profile (name, company, products, value props) for contextual email generation
- Email signatures automatically use the sender's first name from their profile

**Data Storage:**
- In-memory storage implementation (MemStorage class) for development
- Interface-based design (IStorage) allows swapping to persistent storage
- Campaign and prospect state tracking with status updates
- UUID-based entity identification

### External Dependencies

**Database:**
- Drizzle ORM configured for PostgreSQL via Neon Database (@neondatabase/serverless)
- Schema defined in `shared/schema.ts` using Drizzle's type-safe schema builder
- Migration support via drizzle-kit
- **Note:** Database schema not yet implemented; storage currently in-memory

**AI Services:**
- OpenAI-compatible API via Replit AI Integrations
- Environment variables: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- Fallback support for standard OpenAI API integration

**LinkedIn Enrichment:**
- Mock implementation in current codebase (placeholder service)
- Designed for future integration with LinkedIn scraping or enrichment APIs
- Type-safe prospect schema supports LinkedIn URL and contextual notes

**Third-Party Libraries:**
- `papaparse` or `csv-parser` for CSV file processing (frontend-based parsing)
- `zod` for runtime schema validation across client and server
- `nanoid` and `uuid` for unique identifier generation
- Express middleware: `express-session`, `connect-pg-simple` for session management (configured but not fully utilized)

**Email Delivery (SendGrid):**
- SendGrid integration via `@sendgrid/mail` package
- API endpoint: `POST /api/send-email` for sending generated emails
- Service layer: `server/sendgrid.ts`

**SendGrid Setup Instructions:**
1. Create a SendGrid account at https://sendgrid.com
2. Go to Settings > API Keys and create a new API key with "Mail Send" permissions
3. In Replit, go to Secrets (Tools > Secrets) and add:
   - Key: `SENDGRID_API_KEY`
   - Value: Your SendGrid API key (starts with `SG.`)
4. Verify a sender email in SendGrid (Settings > Sender Authentication)
5. Use that verified email as the "From" address when sending

**Development Tools:**
- Replit-specific plugins for vite: runtime error overlay, cartographer, dev banner
- HMR (Hot Module Replacement) via WebSocket on `/vite-hmr` path
- TypeScript compilation checking without emit

**Build & Deployment:**
- Production build creates bundled server (dist/index.cjs) and static client assets (dist/public)
- Server dependencies selectively bundled using allowlist to optimize cold start performance
- Environment-based configuration for development vs production modes