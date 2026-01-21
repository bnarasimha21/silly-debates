# Silly Debates - Implementation Plan

## Overview
A month-long daily debate game where users submit entries, vote, and interact with an AI chatbot to explore past debates.

**Duration:** 30 days
**Platform:** Web app (DigitalOcean App Platform + Serverless Inference + Gradient KB)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                │
│                   Next.js on App Platform                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Home/   │  │  Submit  │  │ Results/ │  │   Chatbot     │  │
│  │  Vote    │  │  Entry   │  │ History  │  │   (Ask AI)    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
└───────────────────────┬────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────┐
│                     BACKEND API                                │
│                 Next.js API Routes                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ /api/debates │  │ /api/votes   │  │ /api/entries         │ │
│  │ /api/cron/*  │  │ /api/chat    │  │ /api/test-spaces     │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└──────────┬─────────────────┬───────────────────┬───────────────┘
           │                 │                   │
           ▼                 ▼                   ▼
┌─────────────────┐  ┌───────────────┐  ┌────────────────────────┐
│   PostgreSQL    │  │  Serverless   │  │   DO Spaces +          │
│   (DO Managed)  │  │  Inference    │  │   Gradient KB          │
│                 │  │               │  │                        │
│ - users         │  │ - Topic Gen   │  │ - debates/*.json       │
│ - debates       │  │ - Moderator   │  │ - debates/*.txt        │
│ - entries       │  │ - Commentary  │  │ - KB Retrieval API     │
│ - votes         │  │ - Chat + RAG  │  │                        │
└─────────────────┘  └───────────────┘  └────────────────────────┘
                              │
                              ▼
                     ┌───────────────┐
                     │ DO Functions  │
                     │ (Cron Jobs)   │
                     │               │
                     │ - close-debate│
                     │ - new-debate  │
                     └───────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router) |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes |
| Database | DigitalOcean Managed PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js v5 (Google/GitHub OAuth) |
| AI | DigitalOcean Serverless Inference (Llama 3.3 70B) |
| Knowledge Base | DigitalOcean Spaces + Gradient KB Retrieval API |
| Hosting | DigitalOcean App Platform |
| Cron Jobs | DigitalOcean Functions |

---

## AI Integration (Serverless Inference)

Instead of Gradient AI Agents, we use **Serverless Inference** with prompt-based AI functions:

### 1. Topic Generator
**Purpose:** Generate daily debate topics
**Implementation:** `src/lib/ai.ts` - `generateDebateTopic()`
**Trigger:** DO Function cron at 9:01 AM EST daily

### 2. Content Moderator
**Purpose:** Filter user-submitted entries
**Implementation:** `src/lib/ai.ts` - `moderateContent()`
**Trigger:** On every entry submission via `/api/entries`
**Response:** `{ "approved": true/false, "reason": "..." }`

### 3. Winner Commentary
**Purpose:** Generate fun announcements for daily winners
**Implementation:** `src/lib/ai.ts` - `generateWinnerCommentary()`
**Trigger:** DO Function cron at 8:59 AM EST daily (when closing debate)

### 4. RAG Chatbot
**Purpose:** Answer user questions about past debates
**Implementation:**
- `src/lib/ai.ts` - `chatWithKBContext()`
- `src/lib/gradient-kb.ts` - KB retrieval
**Data Source:** Gradient Knowledge Base (populated from Spaces)

---

## Knowledge Base Architecture

### Data Flow
1. **Debate closes** → `close-debate` cron runs
2. **Upload to Spaces** → JSON + TXT files to `silly-debates` bucket
3. **Gradient KB indexes** → KB reads from Spaces bucket
4. **Chat queries KB** → `/api/chat` calls KB retrieval API
5. **LLM generates response** → Serverless Inference with KB context

### Files in Spaces
```
silly-debates/
├── debates/
│   ├── day-01.json    # Structured debate data
│   ├── day-01.txt     # Human-readable for better RAG
│   ├── day-02.json
│   ├── day-02.txt
│   └── summary.json   # Optional: all debates summary
```

---

## Database Schema

```sql
-- Users table (NextAuth compatible)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  email_verified TIMESTAMP,
  image TEXT,
  wins_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Debates table
CREATE TABLE debates (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  day_number INT UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, CLOSED
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  winning_entry_id TEXT UNIQUE,
  winner_commentary TEXT
);

-- Entries table
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  debate_id TEXT REFERENCES debates(id),
  user_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  vote_count INT DEFAULT 0,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Votes table
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  entry_id TEXT REFERENCES entries(id),
  user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entry_id, user_id)
);
```

---

## API Endpoints

### Debates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/debates/today` | Get today's active debate |

### Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/entries` | Submit entry (runs AI moderation) |

### Votes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/votes` | Cast vote for an entry |
| DELETE | `/api/votes` | Remove vote |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to RAG chatbot |

### Cron (requires CRON_SECRET)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cron/new-debate` | Generate new daily debate |
| POST | `/api/cron/close-debate` | Close debate, announce winner, sync to KB |

### Testing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/test-spaces` | Test Spaces connectivity |

---

## Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| Home | `/` | Current debate, submit entry, vote |
| History | `/history` | List of past debates |
| Debate Detail | `/history/[id]` | Single debate with all entries |
| Leaderboard | `/leaderboard` | Top winners |
| Ask AI | `/chat` | RAG chatbot interface |
| Sign In | `/auth/signin` | OAuth sign in |

---

## Daily Automation (DO Functions)

**Schedule (EST - New York Time):**
```
┌─────────────────────────────────────────────────────────────┐
│                    8:59 AM EST (13:59 UTC)                  │
├─────────────────────────────────────────────────────────────┤
│ close-debate function:                                      │
│ 1. Find active debate                                       │
│ 2. Determine winner (highest votes)                         │
│ 3. Generate AI commentary (Serverless Inference)            │
│ 4. Update winner's wins_count                               │
│ 5. Upload to Spaces (JSON + TXT)                            │
│ 6. Set debate status = CLOSED                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    9:01 AM EST (14:01 UTC)                  │
├─────────────────────────────────────────────────────────────┤
│ new-debate function:                                        │
│ 1. Generate topic (Serverless Inference)                    │
│ 2. Create new debate record                                 │
│ 3. Increment day_number                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETED
- [x] Initialize Next.js project with TypeScript
- [x] Set up Tailwind CSS
- [x] Configure Prisma + PostgreSQL connection
- [x] Create database schema and migrations
- [x] Set up NextAuth.js v5 with Google/GitHub OAuth
- [x] Create basic layout and navigation

### Phase 2: Core Features ✅ COMPLETED
- [x] Build debate display page (Home)
- [x] Implement entry submission with validation
- [x] Build voting system
- [x] Create results/history page
- [x] Build debate detail page
- [x] Add leaderboard

### Phase 3: AI Integration ✅ COMPLETED
- [x] Set up Serverless Inference client (`src/lib/ai.ts`)
- [x] Implement AI functions:
  - [x] Topic Generator
  - [x] Content Moderator
  - [x] Winner Commentary
- [x] Set up Spaces integration (`src/lib/spaces.ts`)
- [x] Create Gradient Knowledge Base (manual in console)
- [x] Implement KB retrieval (`src/lib/gradient-kb.ts`)
- [x] Build chat interface with RAG

### Phase 4: Automation & Polish (Partial) ✅ COMPLETED
- [x] Set up DO Functions for cron jobs
- [x] Deploy functions with scheduled triggers
- [x] Configure cron schedule (9 AM EST)

### Phase 5: Deployment & Testing (Partial) ✅ COMPLETED
- [x] Deploy to DigitalOcean App Platform
- [x] Configure environment variables
- [x] Connect to managed PostgreSQL
- [x] Deploy DO Functions
- [x] Configure OAuth redirect URLs
- [x] Test full flow end-to-end

---

## Remaining Work (Parallelizable Sub-Agent Tasks)

The following tasks are independent and can be executed **in parallel** by sub-agents. Each task has clear boundaries and minimal dependencies.

### Task A: Real-Time Vote Updates (Optional)
**Agent Type:** `phase-4-implementer`
**Dependencies:** None
**Files to modify:**
- `src/app/page.tsx` (home page)
- `src/app/api/votes/route.ts`
- `src/components/` (new WebSocket or polling component)

**Scope:**
- [ ] Implement real-time vote count updates using one of:
  - Server-Sent Events (SSE) - simpler
  - WebSocket connection - more complex
  - Polling with SWR/React Query - simplest
- [ ] Update vote counts on home page without full page refresh
- [ ] Handle optimistic updates for better UX

**Acceptance Criteria:**
- Vote counts update within 5 seconds of another user voting
- No page refresh required
- Graceful fallback if real-time fails

---

### Task B: Mobile-Responsive Design Polish
**Agent Type:** `phase-4-implementer`
**Dependencies:** None
**Files to modify:**
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/history/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/chat/page.tsx`
- `src/components/*.tsx`

**Scope:**
- [ ] Audit all pages for mobile breakpoints (sm, md, lg)
- [ ] Fix any overflow issues on small screens
- [ ] Ensure touch targets are at least 44x44px
- [ ] Test navigation on mobile viewports
- [ ] Optimize card layouts for mobile (stack vs grid)
- [ ] Ensure forms are usable on mobile keyboards

**Acceptance Criteria:**
- All pages render correctly on 320px-768px viewports
- No horizontal scrolling on mobile
- All interactive elements are touch-friendly

---

### Task C: Loading States & Error Handling
**Agent Type:** `phase-4-implementer`
**Dependencies:** None
**Files to modify:**
- `src/app/page.tsx`
- `src/app/history/page.tsx`
- `src/app/history/[id]/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/chat/page.tsx`
- `src/components/` (new loading/error components)

**Scope:**
- [ ] Add loading skeletons for all data-fetching pages
- [ ] Implement error boundaries for React components
- [ ] Add user-friendly error messages for API failures
- [ ] Add retry buttons for failed requests
- [ ] Handle empty states gracefully (no debates, no entries, etc.)
- [ ] Add loading indicators for form submissions

**Acceptance Criteria:**
- Users see loading feedback within 100ms of navigation
- All API errors show actionable error messages
- Empty states have helpful guidance text

---

### Task D: Rate Limiting
**Agent Type:** `phase-4-implementer`
**Dependencies:** None
**Files to modify:**
- `src/lib/rate-limit.ts` (new file)
- `src/app/api/entries/route.ts`
- `src/app/api/votes/route.ts`
- `src/app/api/chat/route.ts`

**Scope:**
- [ ] Create rate limiting middleware/utility
- [ ] Apply rate limits to entry submission (e.g., 5 per hour)
- [ ] Apply rate limits to voting (e.g., 30 per minute)
- [ ] Apply rate limits to chat API (e.g., 20 per minute)
- [ ] Return appropriate 429 status codes with retry-after headers
- [ ] Consider using Upstash Redis for distributed rate limiting (optional)

**Acceptance Criteria:**
- Rate limits are enforced per user (authenticated) or IP (anonymous)
- Clear error messages when rate limited
- Rate limits are configurable via environment variables

---

### Task E: Monitoring & Logging
**Agent Type:** `phase-5-implementer`
**Dependencies:** None
**Files to modify:**
- `src/lib/logger.ts` (new file)
- `src/app/api/*/route.ts` (all API routes)
- `.do/app.yaml` (logging configuration)

**Scope:**
- [ ] Set up structured logging utility
- [ ] Add request/response logging to API routes
- [ ] Log AI API calls (topic generation, moderation, chat)
- [ ] Log cron job executions and results
- [ ] Configure DigitalOcean App Platform logging
- [ ] Add error tracking (optional: integrate Sentry or similar)
- [ ] Create health check endpoint (`/api/health`)

**Acceptance Criteria:**
- All API requests are logged with timestamp, user, and duration
- Errors include stack traces in logs
- Logs are viewable in DigitalOcean console

---

## Sub-Agent Execution Guide

### Parallel Execution Matrix
```
┌─────────────────────────────────────────────────────────────────┐
│                    PARALLELIZABLE TASKS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Task A   │  │ Task B   │  │ Task C   │  │ Task D   │        │
│  │ Real-    │  │ Mobile   │  │ Loading/ │  │ Rate     │        │
│  │ time     │  │ Resp.    │  │ Error    │  │ Limiting │        │
│  │ Updates  │  │ Design   │  │ Handling │  │          │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                           │                                     │
│                           ▼                                     │
│                    ┌──────────┐                                 │
│                    │ Task E   │                                 │
│                    │ Monitor/ │  (Can also run in parallel,    │
│                    │ Logging  │   but benefits from seeing      │
│                    └──────────┘   other task patterns)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Instructions
1. **Check out a fresh branch** for your task (e.g., `feature/task-a-realtime-votes`)
2. **Read the scope** and files listed for your task
3. **Implement incrementally** with tests where applicable
4. **Do not modify files** outside your task scope unless necessary
5. **Mark checkboxes** in this file as you complete items
6. **Create a PR** when complete with task letter in title (e.g., "Task B: Mobile responsive polish")

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth.js
NEXTAUTH_URL="https://your-app.ondigitalocean.app"
NEXTAUTH_SECRET="..."
AUTH_TRUST_HOST="true"

# OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# Serverless Inference
GRADIENT_API_KEY="..."  # Model access key
GRADIENT_INFERENCE_URL="https://inference.do-ai.run/v1/chat/completions"
GRADIENT_INFERENCE_MODEL="llama3.3-70b-instruct"

# Gradient Knowledge Base
GRADIENT_KB_UUID="..."
DO_API_TOKEN="..."  # With GenAI:read scope

# Spaces
SPACES_KEY="..."
SPACES_SECRET="..."
SPACES_BUCKET="silly-debates"
SPACES_REGION="nyc3"

# Cron
CRON_SECRET="..."
```

---

## Cost Estimates (DigitalOcean)

| Service | Tier | Est. Monthly Cost |
|---------|------|-------------------|
| App Platform | Basic | $5 |
| Managed PostgreSQL | Basic | $15 |
| Serverless Inference | Pay-as-you-go | ~$5-10 |
| Spaces | 250GB included | $5 |
| Functions | 25K invocations free | $0 |
| Gradient KB | OpenSearch | ~$15 |
| **Total** | | **~$45-50/month** |

---

## Project Structure

```
silly-debates/
├── .claude/
│   └── agents/           # Claude Code agents
├── .do/
│   └── app.yaml          # App Platform spec
├── functions/
│   ├── project.yml       # DO Functions config
│   └── packages/cron/
│       ├── close-debate/
│       └── new-debate/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── chat/
│   │   │   ├── cron/
│   │   │   ├── debates/
│   │   │   ├── entries/
│   │   │   ├── votes/
│   │   │   └── test-spaces/
│   │   ├── chat/
│   │   ├── history/
│   │   ├── leaderboard/
│   │   └── auth/
│   ├── components/
│   └── lib/
│       ├── ai.ts
│       ├── auth.ts
│       ├── gradient-kb.ts
│       ├── knowledge-base.ts
│       ├── prisma.ts
│       └── spaces.ts
└── package.json
```
