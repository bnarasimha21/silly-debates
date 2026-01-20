# Silly Debates

A fun, month-long daily debate game where users submit creative entries, vote on their favorites, and chat with an AI about past debates.

## Features

- **Daily Debates**: New silly debate topics generated each day by AI
- **User Entries**: Submit your funniest/most creative answers (one per debate)
- **Voting**: Vote for your favorite entries
- **AI-Powered**:
  - Topic generation using DigitalOcean Serverless Inference
  - Content moderation for submissions
  - Winner commentary generation
  - RAG-powered chatbot to explore debate history
- **Leaderboard**: Track top winners across all debates
- **History**: Browse past debates and winning entries

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL (DigitalOcean Managed) |
| ORM | Prisma |
| Auth | NextAuth.js (Google/GitHub OAuth) |
| AI | DigitalOcean Gradient AI (Serverless Inference) |
| Knowledge Base | DigitalOcean Spaces + Gradient KB |
| Hosting | DigitalOcean App Platform |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- DigitalOcean account (for AI features)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bnarasimha21/silly-debates.git
   cd silly-debates
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with:
   - Database URL
   - NextAuth secrets and OAuth credentials
   - DigitalOcean API keys (Gradient, Spaces)

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - App URL for auth
- `NEXTAUTH_SECRET` - Auth encryption secret
- `GOOGLE_CLIENT_ID/SECRET` - Google OAuth
- `GITHUB_CLIENT_ID/SECRET` - GitHub OAuth
- `GRADIENT_API_KEY` - DigitalOcean model access key
- `SPACES_KEY/SECRET` - DigitalOcean Spaces credentials
- `GRADIENT_KB_UUID` - Knowledge Base UUID
- `DO_API_TOKEN` - DigitalOcean API token (GenAI:read scope)
- `CRON_SECRET` - Secret for cron job authentication

## API Endpoints

### Public
- `GET /api/debates/today` - Get today's active debate
- `POST /api/chat` - Chat with AI about debate history

### Authenticated
- `POST /api/entries` - Submit an entry
- `POST /api/votes` - Vote for an entry
- `DELETE /api/votes` - Remove a vote

### Cron (requires CRON_SECRET)
- `POST /api/cron/new-debate` - Generate new daily debate
- `POST /api/cron/close-debate` - Close debate and announce winner

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── chat/          # AI chat page
│   ├── history/       # Past debates
│   ├── leaderboard/   # Top winners
│   └── page.tsx       # Home (current debate)
├── components/        # React components
└── lib/
    ├── ai.ts          # AI utilities (Serverless Inference)
    ├── gradient-kb.ts # Knowledge Base retrieval
    ├── spaces.ts      # Spaces upload for KB sync
    ├── prisma.ts      # Database client
    └── auth.ts        # NextAuth configuration
```

## Deployment

Deploy to DigitalOcean App Platform:

1. Push code to GitHub
2. Create new App in DO App Platform
3. Connect to your GitHub repo
4. Add environment variables
5. Add managed PostgreSQL database
6. Deploy

## License

MIT
