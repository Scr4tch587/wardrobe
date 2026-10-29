import { Link } from "react-router";
import type { Route } from "./+types/stats";
import { Bars } from "../components/charts";
import { PageTitle, formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { StatsData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Stats · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<StatsData> {
  return callEdge(request, "stats");
}

export default function Stats({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-12">
      <PageTitle kicker={`Through ${formatDate(loaderData.cutoff)}`} title="Stats" />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Outfits" value={String(loaderData.total)} />
        <Stat label="Average rating" value={loaderData.avgRating == null ? "—" : loaderData.avgRating.toFixed(1)} />
        <Stat label="Current streak" value={`${loaderData.streak.current} days`} />
        <Stat label="Longest streak" value={`${loaderData.streak.longest} days`} />
      </dl>
      <p>
        {loaderData.concentration == null
          ? "No wears yet."
          : `${Math.round(loaderData.concentration)}% of items account for half of all wears.`}
      </p>
      <section>
        <h2 className="font-display text-3xl italic">Wears by slot</h2>
        <Bars rows={loaderData.slots} />
      </section>
      <section>
        <h2 className="font-display text-3xl italic">Rating vs temperature</h2>
        {loaderData.temps.length === 0 ? <p className="text-muted">Not enough rated days with weather.</p> : <Bars rows={loaderData.temps} />}
      </section>
      <section>
        <h2 className="font-display text-3xl italic">Suggestions vs own picks</h2>
        {loaderData.visitor.length === 0 ? (
          <p className="text-muted">No rated outfits yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {loaderData.visitor.map((row) => (
              <li key={row.label}>
                {row.label}: {row.outfits} rated, average {row.rating == null ? "—" : row.rating.toFixed(1)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-3xl italic">Quiet pieces</h2>
        {loaderData.dormant.length === 0 ? (
          <p className="text-muted">Nothing has been sitting for 90 days.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {loaderData.dormant.map((item) => (
              <li key={item.id}>
                <Link to={`/items/${item.id}`} className="text-rust">
                  {item.name}
                </Link>
                <span className="text-muted"> · {item.lastWorn ? formatDate(item.lastWorn) : "never worn"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-display text-3xl italic">{value}</dd>
    </div>
  );
}
