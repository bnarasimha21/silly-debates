import { prisma } from "./prisma";

/**
 * Growth metrics computed from the Event table. Days are UTC calendar days.
 * "Actor" means the visitor cookie id, falling back to the user id.
 */

export interface DailyRow {
  day: string;
  visitors: number;
  voters: number;
  submitters: number;
  sharers: number;
  landings: number;
  signins: number;
  returnedNextDay: number | null; // null until the next day has started
}

export interface Funnel {
  visitors: number;
  voted: number;
  submitted: number;
  shared: number;
}

export interface Metrics {
  days: DailyRow[];
  funnel: Funnel;
  activeActors: number;
  invitedVisitors: number;
  inviteRate: number | null;
  nextDayReturn: number | null;
  totalEvents: number;
}

type Raw = Record<string, bigint | number | string | Date | null>;
const num = (value: Raw[string]) => (value === null ? 0 : Number(value));

export async function getMetrics(windowDays = 14): Promise<Metrics> {
  const daily = await prisma.$queryRaw<Raw[]>`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', now() AT TIME ZONE 'utc') - (${windowDays - 1} * interval '1 day'),
        date_trunc('day', now() AT TIME ZONE 'utc'),
        interval '1 day'
      ) AS day
    ),
    ev AS (
      SELECT name,
             COALESCE("visitorId", "userId") AS actor,
             date_trunc('day', "createdAt") AS day
      FROM "Event"
      WHERE "createdAt" >= date_trunc('day', now() AT TIME ZONE 'utc') - (${windowDays} * interval '1 day')
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT e.actor) FILTER (WHERE e.name = 'visit') AS visitors,
      COUNT(DISTINCT e.actor) FILTER (WHERE e.name = 'vote') AS voters,
      COUNT(DISTINCT e.actor) FILTER (WHERE e.name = 'entry_submit') AS submitters,
      COUNT(DISTINCT e.actor) FILTER (WHERE e.name = 'share_click') AS sharers,
      COUNT(DISTINCT e.actor) FILTER (WHERE e.name = 'share_landing') AS landings,
      COUNT(*) FILTER (WHERE e.name = 'signin_done') AS signins,
      (
        SELECT COUNT(DISTINCT a.actor)
        FROM ev a
        WHERE a.day = d.day
          AND EXISTS (
            SELECT 1 FROM ev b
            WHERE b.actor = a.actor AND b.day = d.day + interval '1 day'
          )
      ) AS returned
    FROM days d
    LEFT JOIN ev e ON e.day = d.day
    GROUP BY d.day
    ORDER BY d.day DESC
  `;

  const today = new Date().toISOString().slice(0, 10);
  const days: DailyRow[] = daily.map((row) => ({
    day: String(row.day),
    visitors: num(row.visitors),
    voters: num(row.voters),
    submitters: num(row.submitters),
    sharers: num(row.sharers),
    landings: num(row.landings),
    signins: num(row.signins),
    returnedNextDay: String(row.day) === today ? null : num(row.returned),
  }));

  const [funnelRow] = await prisma.$queryRaw<Raw[]>`
    WITH ev AS (
      SELECT name, COALESCE("visitorId", "userId") AS actor
      FROM "Event"
      WHERE "createdAt" >= now() - interval '7 days'
    ),
    visitors AS (SELECT DISTINCT actor FROM ev WHERE name = 'visit')
    SELECT
      (SELECT COUNT(*) FROM visitors) AS visitors,
      (SELECT COUNT(DISTINCT actor) FROM ev WHERE name = 'vote' AND actor IN (SELECT actor FROM visitors)) AS voted,
      (SELECT COUNT(DISTINCT actor) FROM ev WHERE name = 'entry_submit' AND actor IN (SELECT actor FROM visitors)) AS submitted,
      (SELECT COUNT(DISTINCT actor) FROM ev WHERE name = 'share_click' AND actor IN (SELECT actor FROM visitors)) AS shared,
      (SELECT COUNT(DISTINCT actor) FROM ev WHERE name IN ('vote', 'entry_submit')) AS active,
      (SELECT COUNT(DISTINCT actor) FROM ev WHERE name = 'share_landing') AS invited
  `;

  const funnel: Funnel = {
    visitors: num(funnelRow.visitors),
    voted: num(funnelRow.voted),
    submitted: num(funnelRow.submitted),
    shared: num(funnelRow.shared),
  };
  const activeActors = num(funnelRow.active);
  const invitedVisitors = num(funnelRow.invited);

  // Next-day return over the window. Yesterday is included as a running
  // figure, since "today" is still in progress.
  const completed = days.filter((d) => d.returnedNextDay !== null);
  const base = completed.reduce((sum, d) => sum + d.visitors, 0);
  const returned = completed.reduce((sum, d) => sum + (d.returnedNextDay ?? 0), 0);

  const totalEvents = await prisma.event.count();

  return {
    days,
    funnel,
    activeActors,
    invitedVisitors,
    inviteRate: activeActors > 0 ? invitedVisitors / activeActors : null,
    nextDayReturn: base > 0 ? returned / base : null,
    totalEvents,
  };
}
