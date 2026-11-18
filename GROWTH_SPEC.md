# Silly Debates - Growth Spec

## 1. Goal

Turn Silly Debates from an app that gets a few users a week into one where each
user brings in others and comes back the next day.

Two numbers define success. Everything in this spec exists to move one of them.

| Metric | Definition | Today |
|--------|------------|-------|
| Invite rate | New visitors arriving via a shared link, per active user, per week | Not measured (no sharing exists) |
| Next-day return | Share of people active on day N who are active on day N+1 | Not measured (no analytics exist) |

The thresholds in the phase gates below are starting proposals, not industry
benchmarks. Adjust them once Phase 0 gives real baselines.

## 2. Current state (from the code)

| Area | Finding | Where |
|------|---------|-------|
| Sharing | No share button, no Open Graph image, no per-entry URL | `src/app/layout.tsx`, `src/components/debate-view.tsx` |
| Friction | Voting and submitting both require Google or GitHub OAuth | `src/app/api/votes/route.ts`, `src/app/api/entries/route.ts` |
| Lifespan | Game stops after day 30; `dayNumber` is unique 1-30 | `src/app/api/cron/new-debate/route.ts:58`, `prisma/schema.prisma` |
| Retention | No email, push, streaks or win notifications | - |
| Analytics | None | - |
| Winner | Highest `voteCount`, ties broken arbitrarily | `src/app/api/cron/close-debate/route.ts` |
| Entry limit | README says one entry per debate; the API allows many | `src/app/api/entries/route.ts` |
| Domain | Served from `silly-debates-6vhp9.ondigitalocean.app` | `functions/project.yml` |
| Live debate URL | Only closed debates have a page (`/history/[id]`) | `src/app/history/[id]/page.tsx` |

## 3. Principles

1. **Measure before building.** No phase after Phase 0 ships without its events.
2. **Gate each phase.** A phase starts only when the previous gate is met or
   consciously waived. If a gate fails, fix that loop before adding features.
3. **Fun before signup.** A visitor must be able to do something enjoyable
   within one tap of landing.
4. **Every output is an ad.** Anything a user creates or wins must be shareable
   as a link with a good preview image.
5. **No new infrastructure unless needed.** Prefer Next.js built-ins, Postgres
   and the existing DigitalOcean setup.

## 4. Phase overview

| Phase | Theme | Rough size | Gate to move on |
|-------|-------|------------|-----------------|
| 0 | Foundations and measurement | 2-3 days | Events flowing; game no longer ends at day 30 |
| 1 | Share loop | 3-4 days | 15% of submitters share; shared links produce votes |
| 2 | Remove friction | 2-3 days | 40% of new visitors cast a vote |
| 3 | Fix the empty room | 4-6 days | Median votes per visitor of 5 or more |
| 4 | Retention | 4-5 days | Next-day return of 20% or more |
| 5 | Groups | 1-2 weeks | 30% of leagues active in week 2 |
| 6 | Reach | Ongoing | - |

Because traffic is tiny today, gates cannot be read from organic usage. For
each gate, drive a one-off batch of roughly 300-500 visitors (personal network,
one community post) and read the funnel from that batch.

---

## Phase 0 - Foundations and measurement

### 0.1 Event tracking
- Add an `Event` table: `id`, `name`, `visitorId`, `userId?`, `debateId?`,
  `entryId?`, `ref?`, `props Json?`, `createdAt`.
- `visitorId` comes from a signed, httpOnly, one-year cookie set by middleware
  on first visit. This cookie is reused for anonymous voting in Phase 2.
- Add `src/lib/track.ts` with a server-side `track(name, ctx)` helper and a
  `POST /api/events` route for client events.
- Events: `visit`, `vote`, `entry_submit`, `entry_rejected`, `share_click`,
  `share_landing`, `signin_start`, `signin_done`, `pair_vote`, `notif_open`.
- Shared links carry `?ref=<visitorId-short>&src=<channel>` so invites can be
  attributed.
- Add a protected `/admin/metrics` page showing daily visitors, funnel
  (visit to vote to submit to share), invite rate and next-day return.

### 0.2 Seasons instead of a 30-day end
- Add `Season` (`id`, `number`, `startsAt`, `endsAt`).
- Replace `Debate.dayNumber @unique` with `@@unique([seasonId, dayNumber])`.
- `new-debate` cron rolls into a new season after day 30 instead of returning
  an error. Leaderboard gains "this season" and "all time" views.
- Migrate existing debates into Season 1.

### 0.3 Correctness fixes that growth will expose
- Tie-break: earliest entry wins among equal vote counts; store it explicitly.
- Enforce one entry per user per debate (`@@unique([debateId, userId])`), to
  match the README and stop vote-splitting.
- Custom domain, with `NEXTAUTH_URL` and `APP_URL` updated. Short and sayable.
- Add `metadataBase` in `src/app/layout.tsx` so OG URLs resolve.

**Done when:** `/admin/metrics` shows a live funnel and day 31 creates Season 2 Day 1.

---

## Phase 1 - Share loop

### 1.1 Public pages
- `/d/[id]` - any debate, active or closed. Active shows voting; closed shows
  results. `/history/[id]` redirects here.
- `/e/[id]` - a single entry: topic, the answer, author, live vote count, a
  large vote button, then "See all answers" and "Submit your own".

### 1.2 Preview images
- Use `next/og` `ImageResponse` (built into Next.js, no new dependency) via
  `opengraph-image.tsx` for `/`, `/d/[id]` and `/e/[id]`.
- Entry card: topic, answer in large type, author name, "Vote for this answer".
- Winner card variant: "Winner - Day N", answer, one line of AI commentary.
- 1200x630 for links, plus a 1080x1920 story variant at `/e/[id]/story.png`
  for download.

### 1.3 Share actions
- After submitting: a modal, "Your answer is live. Share it to get votes."
- Buttons: native share sheet (`navigator.share`) on mobile; WhatsApp, X and
  copy link elsewhere. Pre-filled text includes the topic.
- Share button on every entry and on the results page.
- Winner gets a "Share your win" prompt on next visit.

### 1.4 Tracking
- `share_click` with channel; `share_landing` when a `ref` link is opened.

**Done when:** pasting an entry link into WhatsApp, X, Slack and iMessage shows
the card, and a share-to-vote path is visible in `/admin/metrics`.

**Gate:** 15% of submitters share, and at least 1 vote per share on average.

---

## Phase 2 - Remove friction

### 2.1 Anonymous voting
- `Vote.userId` becomes nullable; add `Vote.visitorId`. Uniqueness becomes one
  vote per entry per voter key (user id if signed in, else visitor id).
- `POST /api/votes` accepts either a session or the visitor cookie.
- Abuse limits: cap anonymous votes per debate per hashed IP (start at 5),
  basic bot user-agent filter, votes from cookies less than 3 seconds old
  rejected. Store only a salted hash of the IP.
- On sign-in, the visitor's votes are attached to the user; duplicates dropped.
- Admin metrics show the anonymous vs signed-in vote split per debate so
  stuffing is visible.

### 2.2 Signup only where it earns its place
- Submitting still requires an account (needed for moderation, wins, and
  notifications).
- Let visitors type their answer first, then ask them to sign in to post it.
  The draft is kept in `localStorage` across the OAuth round trip.
- Add email magic-link sign-in. Order providers: Google, email, GitHub.

### 2.3 Landing
- First screen is today's topic and something to vote on. No explainer above it.
- Visitors arriving at `/e/[id]` see that entry first, not the home page.

**Gate:** 40% of new visitors cast at least one vote.

---

## Phase 3 - Fix the empty room

### 3.1 Seeded answers
- Add `User.isBot`. Create a small set of named house bots.
- When a debate opens, generate 8-10 answers through the existing inference
  client in `src/lib/ai.ts`, run them through the same moderation, and post
  them spread over the first hours.
- Bot answers are visibly labelled, can be voted on, and are excluded from
  winning and from the leaderboard.
- Stop seeding a debate once it has 15 human entries.

### 3.2 Head-to-head voting
- New default voting screen: two answers side by side, "Which is funnier?",
  tap one, next pair appears.
- Add `PairVote` (`winnerEntryId`, `loserEntryId`, voter key, `createdAt`).
- Pair selection favours entries with the fewest comparisons, so late entries
  get fair exposure.
- Ranking: win rate with a minimum-comparisons floor (smoothed so a 1-0 entry
  does not top the list). The full ranked list stays available as "See all".
- Ship behind a flag and compare against list voting on votes per visitor
  before making it the default. This is the largest product change in the spec.

**Gate:** median of 5 or more votes per voting visitor.

---

## Phase 4 - Retention

### 4.1 Streaks
- `User.currentStreak`, `longestStreak`, `lastActiveDay`. Voting or submitting
  counts. Shown in the navbar and on share cards.
- Anonymous visitors see their streak from the cookie, with "Sign in to keep it".

### 4.2 Notifications
- Add `NotificationPref` (email on/off, push on/off, timezone).
- Transactional email provider (one new dependency; choose at implementation).
- Emails: "Today's debate is live", "Your answer is #N, X votes behind",
  "You won Day N". One email a day at most; one-click unsubscribe.
- Web push via a service worker for the same three moments.
- Sent from the existing cron functions plus one new mid-day "standings" cron.

### 4.3 Results as an event
- Fixed, published closing time with a countdown on the home page.
- Results page reveals third, second, then first place.

**Gate:** next-day return of 20% or more among signed-in users.

---

## Phase 5 - Groups

### 5.1 Private leagues
- `League` (`id`, `name`, `slug`, `ownerId`, `inviteCode`) and `LeagueMember`.
- A league plays the same daily topic but has its own entries, votes and
  leaderboard. `Entry.leagueId` nullable; null means the public game.
- Join by link, no approval step. Creating a league ends on a share screen.

### 5.2 Slack and Discord
- Start with the cheapest version: an incoming webhook per league that posts
  the daily topic and the results with a link back.
- Build in-thread answering and voting only if webhook leagues retain better
  than plain leagues.

**Gate:** 30% of leagues still active in their second week.

---

## Phase 6 - Reach

- `sitemap.ts` and `robots.ts`; closed debates indexable with descriptive
  titles ("Funniest answers to: <topic>") and structured data.
- Daily "top 3 answers" vertical video generated from the results, posted to
  Reels, Shorts and TikTok. Begin by hand; automate only if clips get views.
- Launch posts (Product Hunt, Show HN, relevant subreddits, a build write-up).
  Hold these until the Phase 1-3 gates are met so the spike is not wasted.

---

## 5. Data model changes (summary)

| Phase | Change |
|-------|--------|
| 0 | New `Event`, `Season`; `Debate.seasonId`; `@@unique([seasonId, dayNumber])`; `Entry @@unique([debateId, userId])` |
| 2 | `Vote.userId` nullable; `Vote.visitorId`; new uniqueness on voter key |
| 3 | `User.isBot`; new `PairVote` |
| 4 | `User` streak fields; new `NotificationPref`, `PushSubscription` |
| 5 | New `League`, `LeagueMember`; `Entry.leagueId` |

## 6. Risks

| Risk | Mitigation |
|------|------------|
| Anonymous vote stuffing decides winners | IP-hash caps, visible anon/signed split, option to weight or exclude anon votes from winner selection |
| Bot answers feel fake | Always labelled; never win; stop once humans fill the room |
| Share cards spread a bad answer | Only moderated entries get a card; add a report link on `/e/[id]` |
| Notification fatigue | One a day maximum, per-type opt-out |
| Core loop is not fun enough | See section 7 - the gates are designed to reveal this early |

## 7. Open decisions

1. Product name and domain.
2. Do anonymous votes count fully towards the winner, or at reduced weight?
3. Does head-to-head replace list voting, or sit beside it?
4. Email provider.
5. Closing time: currently about 14:00 UTC. Which audience timezone is primary?
