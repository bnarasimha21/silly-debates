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

## Status

| Phase | State |
|-------|-------|
| 0 - Foundations and measurement | Built |
| 1 - Share loop | Built |
| 2 - Remove friction | Built (email sign-in needs a Resend key to switch on) |
| 3 to 6 | Not started; each waits for the gate before it |

## 2. State before this work (from the code)

| Area | Finding | Where |
|------|---------|-------|
| Sharing | No share button, no Open Graph image, no per-entry URL | `src/app/layout.tsx`, `src/components/debate-view.tsx` |
| Friction | Voting and submitting both require Google or GitHub OAuth | `src/app/api/votes/route.ts`, `src/app/api/entries/route.ts` |
| Lifespan | Game stops after day 30; `dayNumber` is unique 1-30 | `src/app/api/cron/new-debate/route.ts:58`, `prisma/schema.prisma` |
| Retention | No email, push, streaks or win notifications | - |
| Analytics | None | - |
| Winner | Highest `voteCount`, ties broken arbitrarily | `src/app/api/cron/close-debate/route.ts` |
| Entry limit | README said one entry per debate; many are allowed by design | `src/app/api/entries/route.ts` |
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
- `visitorId` comes from a signed, httpOnly, one-year cookie set by
  `POST /api/events` on the first page view (no middleware needed, and
  crawlers that do not run JavaScript are not counted). This cookie is reused
  for anonymous voting in Phase 2.
- Add `src/lib/track.ts` with a server-side `track(name, ctx)` helper and a
  `POST /api/events` route for client events.
- Events: `visit`, `vote`, `vote_removed`, `entry_submit`, `entry_rejected`,
  `share_click`, `share_landing`, `signin_start`, `signin_done`. Later phases
  add `pair_vote` and `notif_open`.
- Shared links carry `?ref=<visitorId-short>&src=<channel>` so invites can be
  attributed.
- Add a `/admin/metrics` page, visible only to emails in `ADMIN_EMAILS`, showing daily visitors, funnel
  (visit to vote to submit to share), invite rate and next-day return.

### 0.2 Seasons instead of a 30-day end
- Add `Debate.season` (integer, default 1). A separate `Season` table is not
  needed: a season's dates follow from its debates.
- Replace `Debate.dayNumber @unique` with `@@unique([season, dayNumber])`.
- `new-debate` cron rolls into a new season after day 30 instead of returning
  an error. Leaderboard gains "this season" and "all time" views.
- Existing debates become Season 1 through the column default.

### 0.3 Correctness fixes that growth will expose
- Tie-break: earliest entry wins among equal vote counts.
- Multiple entries per user stay allowed. That was a deliberate change
  (migration `allow_multiple_entries`); the README was out of date and is fixed.
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
- `Vote.userId` becomes nullable; add `Vote.visitorId` and `Vote.ipHash`. A
  vote belongs to a user or to a visitor, never both.
- `POST /api/votes` and `DELETE /api/votes/[entryId]` accept either a session
  or the visitor cookie.
- Anonymous votes count fully towards the winner. Among entries tied on
  votes, the one with more signed-in votes wins, then the earliest.
- Abuse limits: at most `ANON_VOTERS_PER_IP` (default 10) anonymous voters per
  debate per network address, and a bot user-agent filter. Only a salted hash
  of the IP is stored. The default is 10 rather than 5 because mobile carriers
  put many real people behind one address.
- On sign-in, the visitor's votes are attached to the user. A vote is dropped
  instead if it is for the user's own entry or the user already voted in that
  debate.
- Admin metrics show the anonymous vs signed-in vote split per debate so
  stuffing is visible.

### 2.2 Signup only where it earns its place
- Submitting still requires an account (needed for moderation, wins, and
  notifications).
- Let visitors type their answer first, then ask them to sign in to post it.
  The draft is kept in `localStorage` across the OAuth round trip.
- Email magic-link sign-in through Resend, shown only when `AUTH_RESEND_KEY`
  and `EMAIL_FROM` are set. Provider order: Google, email, GitHub.

### 2.3 Landing
- First screen is today's topic and something to vote on. No explainer above it.
- Visitors arriving at `/e/[id]` see that entry first, not the home page, and
  can vote on it in one tap.

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
| 0 | New `Event`; `Debate.season`; `@@unique([season, dayNumber])` |
| 2 | `Vote.userId` nullable; `Vote.visitorId`, `Vote.ipHash`; `@@unique([entryId, visitorId])` |
| 3 | `User.isBot`; new `PairVote` |
| 4 | `User` streak fields; new `NotificationPref`, `PushSubscription` |
| 5 | New `League`, `LeagueMember`; `Entry.leagueId` |

## 6. Risks

| Risk | Mitigation |
|------|------------|
| Anonymous vote stuffing decides winners | Per-network cap, signed-in votes break ties, anonymous/signed-in split shown per debate in `/admin/metrics` |
| Bot answers feel fake | Always labelled; never win; stop once humans fill the room |
| Share cards spread a bad answer | Only moderated entries get a card; add a report link on `/e/[id]` |
| Notification fatigue | One a day maximum, per-type opt-out |
| Core loop is not fun enough | See section 7 - the gates are designed to reveal this early |

## 7. Decisions

| Question | Decision |
|----------|----------|
| Product name and domain | Open. Owner is buying a domain. |
| Do anonymous votes count towards the winner? | Yes, fully, with the per-network limit. Ties go to the entry with more signed-in votes. Revisit if `/admin/metrics` shows stuffing. |
| Head-to-head vs list voting | Head-to-head ships beside list voting behind a flag (Phase 3) and becomes the default only if it wins on votes per visitor. |
| Email provider | Resend. |
| Closing time | Unchanged: about 14:00 UTC (evening in India, morning in the US). |
