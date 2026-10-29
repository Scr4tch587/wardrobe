import { Link } from "react-router";
import type { Route } from "./+types/leaderboard";
import { Photo } from "../components/photo";
import { PageTitle, formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { LeaderboardData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Leaderboard · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<LeaderboardData> {
  return callEdge(request, "leaderboard");
}

export default function Leaderboard({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle
        kicker={formatDate(loaderData.today)}
        title="Should wear"
        lede="The same list for everyone today. Yesterday's outfit stays private until tomorrow."
      />
      {loaderData.entries.length === 0 ? (
        <p className="text-muted">No ranking yet. It runs each morning.</p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {loaderData.entries.map((entry) => (
            <li key={entry.id} className="grid grid-cols-[auto_72px_1fr] items-center gap-4 py-4">
              <span className="w-8 font-display text-2xl italic text-muted">{entry.rank}</span>
              <Photo item={entry} sizes="72px" className="aspect-square" />
              <div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <Link to={`/items/${entry.id}`} className="text-lg">
                    {entry.name}
                  </Link>
                  <span className="text-sm text-muted">{entry.score.toFixed(2)}</span>
                  <span className="text-sm text-rust">{entry.movement}</span>
                </div>
                <p className="text-sm text-muted">{entry.explanation}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
