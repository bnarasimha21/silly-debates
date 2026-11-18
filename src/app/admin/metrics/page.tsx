import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Metrics - Silly Debates", robots: { index: false } };

function pct(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function share(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "-";
}

export default async function MetricsPage() {
  if (!(await isAdmin())) notFound();

  const m = await getMetrics(14);
  const steps = [
    { label: "Visited", value: m.funnel.visitors },
    { label: "Voted", value: m.funnel.voted },
    { label: "Submitted", value: m.funnel.submitted },
    { label: "Shared", value: m.funnel.shared },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Growth metrics</h1>
      <p className="text-sm text-gray-500 mb-8">
        Days are UTC. {m.totalEvents.toLocaleString()} events recorded in total.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Invite rate (last 7 days)</p>
          <p className="text-3xl font-bold text-purple-600">
            {m.inviteRate === null ? "-" : m.inviteRate.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {m.invitedVisitors} visitors arrived via shared links, per{" "}
            {m.activeActors} active people (voted or submitted)
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Next-day return (last 14 days)</p>
          <p className="text-3xl font-bold text-purple-600">{pct(m.nextDayReturn)}</p>
          <p className="text-xs text-gray-500 mt-1">
            Share of a day&apos;s visitors who did anything the following day
          </p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Funnel (last 7 days)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {steps.map((step) => (
          <div key={step.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">{step.label}</p>
            <p className="text-2xl font-bold text-gray-800">{step.value}</p>
            <p className="text-xs text-gray-500 mt-1">
              {share(step.value, m.funnel.visitors)} of visitors
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-1">Votes by debate</h2>
      <p className="text-sm text-gray-500 mb-3">
        Many anonymous votes from few networks suggests vote stuffing.
      </p>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Debate</th>
              <th className="px-4 py-3 font-medium text-right">Signed-in votes</th>
              <th className="px-4 py-3 font-medium text-right">Anonymous votes</th>
              <th className="px-4 py-3 font-medium text-right">Networks</th>
            </tr>
          </thead>
          <tbody>
            {m.voteSplit.map((d) => (
              <tr key={d.id} className="border-b border-gray-50 last:border-0 text-gray-800">
                <td className="px-4 py-2">
                  <span className="font-medium whitespace-nowrap">{d.label}</span>
                  <span className="text-gray-500"> · {d.topic}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{d.signedIn}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.anonymous}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.networks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Daily</h2>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Day</th>
              <th className="px-4 py-3 font-medium text-right">Visitors</th>
              <th className="px-4 py-3 font-medium text-right">Voters</th>
              <th className="px-4 py-3 font-medium text-right">Submitters</th>
              <th className="px-4 py-3 font-medium text-right">Sharers</th>
              <th className="px-4 py-3 font-medium text-right">Via shared link</th>
              <th className="px-4 py-3 font-medium text-right">Sign-ins</th>
              <th className="px-4 py-3 font-medium text-right">Back next day</th>
            </tr>
          </thead>
          <tbody>
            {m.days.map((d) => (
              <tr key={d.day} className="border-b border-gray-50 last:border-0 text-gray-800">
                <td className="px-4 py-2 whitespace-nowrap">{d.day}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.visitors}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.voters}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.submitters}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.sharers}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.landings}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.signins}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {d.returnedNextDay === null
                    ? "-"
                    : `${d.returnedNextDay} (${share(d.returnedNextDay, d.visitors)})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
