# Silly Debates - Implementation Plan

## Overview
A month-long daily debate game where users submit entries, vote, and interact with an AI chatbot to explore past debates.

**Duration:** 30 days
**Platform:** Web app (DigitalOcean App Platform + Gradient AI)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                │
│                   Next.js on App Platform                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Home/   │  │  Submit  │  │ Results/ │  │   Chatbot     │  │
│  │  Vote    │  │  Entry   │  │ History  │  │   (Past Data) │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
└───────────────────────┬────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────┐
│                     BACKEND API                                │
│                 Next.js API Routes                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ /api/debates │  │ /api/votes   │  │ /api/entries         │ │
│  │ /api/results │  │ /api/users   │  │ /api/chat            │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└──────────┬─────────────────┬───────────────────┬───────────────┘
           │                 │                   │
           ▼                 ▼                   ▼
┌─────────────────┐  ┌───────────────┐  ┌────────────────────────┐
│   PostgreSQL    │  │   Gradient    │  │      Gradient          │
│   (DO Managed)  │  │   Agents      │  │    Knowledge Base      │
│                 │  │               │  │                        │
│ - users         │  │ - Topic Gen   │  │ - Past debates         │
│ - debates       │  │ - Moderator   │  │ - Winners              │
│ - entries       │  │ - Commentary  │  │ - Statistics           │
│ - votes         │  │ - Chatbot     │  │                        │
└─────────────────┘  └───────────────┘  └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes |
| Database | DigitalOcean Managed PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js (Google/GitHub OAuth) |
| AI | DigitalOcean Gradient AI Platform |
| Hosting | DigitalOcean App Platform |
| Cron Jobs | DigitalOcean Functions (or App Platform Workers) |

---

## Gradient AI Agents

### 1. Topic Generator Agent
**Purpose:** Generate daily debate topics
**Trigger:** Daily cron job at midnight
**Prompt Strategy:**
```
You are a creative debate topic generator for a fun, lighthearted game.
Generate ONE unique, silly debate topic that:
- Is family-friendly and inclusive
- Encourages creative/funny responses
- Has no objectively "correct" answer
- Falls into categories like: food, excuses, movies, life situations, hypotheticals

Previously used topics: {list from knowledge base}

Output format: Just the topic as a question (e.g., "What's the best excuse for being late?")
```

### 2. Content Moderation Agent
**Purpose:** Filter user-submitted entries
**Trigger:** On every entry submission
**Guardrails:**
- No profanity/hate speech
- No personal attacks
- Must be relevant to the topic
- No spam/repetitive content

**Response:** `{ "approved": true/false, "reason": "..." }`

### 3. Winner Commentary Agent
**Purpose:** Generate fun announcements for daily winners
**Trigger:** End of day when closing debate
**Output:** Witty 2-3 sentence commentary about the winning entry

### 4. History Chatbot Agent
**Purpose:** Answer user questions about past debates
**Knowledge Base:** All past debates, entries, votes, winners
**Example Queries:**
- "What was the funniest debate?"
- "Show me all food-related debates"
- "Who has won the most debates?"
- "What was the winning entry for best pizza topping?"

---

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  provider VARCHAR(50), -- google, github
  wins_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Debates table
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  day_number INT NOT NULL, -- 1-30
  status VARCHAR(20) DEFAULT 'active', -- active, closed
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  winning_entry_id UUID,
  winner_commentary TEXT
);

-- Entries table (user submissions)
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID REFERENCES debates(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  vote_count INT DEFAULT 0,
  is_winner BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(debate_id, user_id) -- one entry per user per debate
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entry_id, user_id) -- one vote per user per entry
);

-- Indexes
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_day ON debates(day_number);
CREATE INDEX idx_entries_debate ON entries(debate_id);
CREATE INDEX idx_entries_votes ON entries(vote_count DESC);
CREATE INDEX idx_votes_entry ON votes(entry_id);
```

---

## API Endpoints

### Debates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/debates/today` | Get today's active debate |
| GET | `/api/debates/:id` | Get specific debate with entries |
| GET | `/api/debates/history` | Get all past debates (paginated) |

### Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/entries` | Submit entry (runs moderation) |
| GET | `/api/entries/:debateId` | Get entries for a debate |

### Votes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/votes` | Cast vote for an entry |
| DELETE | `/api/votes/:entryId` | Remove vote |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to chatbot |

### Admin/Cron
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cron/new-debate` | Generate new daily debate |
| POST | `/api/cron/close-debate` | Close debate & announce winner |

---

## Frontend Pages

### 1. Home Page (`/`)
- Today's debate topic (large, prominent)
- Entry submission form (if user hasn't submitted)
- List of entries with vote buttons
- Live vote counts
- Countdown timer to debate close
- User's current entry highlighted

### 2. Results Page (`/results`)
- Today's winner announcement with commentary
- Winning entry prominently displayed
- Final vote breakdown
- Winner's profile/stats

### 3. History Page (`/history`)
- Calendar or list view of past 30 days
- Click to see any past debate details
- Filter by category (if tagged)
- Search past debates

### 4. Leaderboard Page (`/leaderboard`)
- Top winners (most debate wins)
- Most popular entries (total votes received)
- Participation stats

### 5. Chat Page (`/chat`)
- Chatbot interface
- Ask questions about past debates
- Example prompts provided
- Conversation history

### 6. Profile Page (`/profile`)
- User's submitted entries
- Win history
- Total votes received
- Badges/achievements (optional)

---

## Daily Automation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MIDNIGHT (00:00)                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Close yesterday's debate                                 │
│    - Set status = 'closed'                                  │
│    - Calculate winner (highest votes)                       │
│    - Generate winner commentary (Gradient Agent)            │
│    - Update winner's win_count                              │
│    - Sync to Knowledge Base                                 │
│                                                             │
│ 2. Generate new debate topic                                │
│    - Call Topic Generator Agent                             │
│    - Create new debate record                               │
│    - Set day_number (1-30)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Tailwind CSS
- [ ] Configure Prisma + PostgreSQL connection
- [ ] Create database schema and migrations
- [ ] Set up NextAuth.js with Google/GitHub OAuth
- [ ] Create basic layout and navigation

### Phase 2: Core Features (Days 4-7)
- [ ] Build debate display page
- [ ] Implement entry submission
- [ ] Build voting system
- [ ] Create results page
- [ ] Build history/archive page
- [ ] Add leaderboard

### Phase 3: Gradient AI Integration (Days 8-10)
- [ ] Set up Gradient AI agents:
  - Topic Generator
  - Content Moderator
  - Winner Commentary
- [ ] Create Knowledge Base for debate history
- [ ] Build chatbot interface
- [ ] Connect chatbot to Knowledge Base (RAG)

### Phase 4: Automation & Polish (Days 11-13)
- [ ] Set up daily cron jobs (new debate, close debate)
- [ ] Add real-time vote updates (optional: WebSockets)
- [ ] Mobile-responsive design polish
- [ ] Add loading states and error handling
- [ ] Implement rate limiting

### Phase 5: Deployment & Testing (Days 14-15)
- [ ] Deploy to DigitalOcean App Platform
- [ ] Configure environment variables
- [ ] Set up managed PostgreSQL
- [ ] Test full flow end-to-end
- [ ] Set up monitoring/logging

---

## Gradient Knowledge Base Structure

Sync this data daily for the chatbot:

```json
{
  "debate": {
    "id": "uuid",
    "day": 15,
    "date": "2026-01-15",
    "topic": "Best excuse for being late to work?",
    "total_entries": 47,
    "total_votes": 234,
    "winner": {
      "user": "john_doe",
      "entry": "My coffee wasn't ready yet and I have priorities",
      "votes": 89
    },
    "runner_up": {
      "user": "jane_smith",
      "entry": "I was busy winning yesterday's debate",
      "votes": 67
    },
    "commentary": "With 89 votes, john_doe's coffee priorities resonated with everyone who's ever hit snooze one too many times!"
  }
}
```

---

## Security Considerations

1. **Rate Limiting**
   - Max 1 entry per user per debate
   - Max 10 votes per user per debate
   - API rate limiting (100 req/min)

2. **Input Validation**
   - Entry max length: 280 characters
   - Sanitize all user inputs
   - AI moderation before storing

3. **Authentication**
   - OAuth only (no passwords to manage)
   - Session-based auth with secure cookies

4. **Vote Integrity**
   - Server-side vote validation
   - Unique constraint on user+entry votes

---

## Cost Estimates (DigitalOcean)

| Service | Tier | Est. Monthly Cost |
|---------|------|-------------------|
| App Platform | Basic ($5) | $5 |
| Managed PostgreSQL | Basic ($15) | $15 |
| Gradient AI | Pay-as-you-go | ~$10-20 |
| **Total** | | **~$30-40/month** |

---

## Optional Enhancements

1. **Social Sharing** - Share winning entries on Twitter/social
2. **Daily Notifications** - Email/push for new debates
3. **Achievements/Badges** - Gamification elements
4. **Debate Categories** - Tag topics (food, movies, life, etc.)
5. **Weekly Recaps** - AI-generated summary of the week
6. **Anonymous Mode** - Option to hide username on entries
7. **Reactions** - Beyond votes, add emoji reactions

---

## Next Steps

1. Confirm this plan meets your requirements
2. Set up DigitalOcean account and create:
   - App Platform project
   - Managed PostgreSQL database
   - Gradient AI workspace
3. Begin Phase 1 implementation

Ready to start building?
