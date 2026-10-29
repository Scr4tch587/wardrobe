import { Link } from "react-router";
import type { Route } from "./+types/suggestions";
import { Photo } from "../components/photo";
import { PageTitle, formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { SuggestionsData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Suggestions · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<SuggestionsData> {
  return callEdge(request, "suggestions");
}

export default function Suggestions({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle kicker="From visitors" title="Approved outfits" />
      <div className="mb-6 flex gap-3 text-sm">
        <Link to="/suggestions?sort=recent" className={loaderData.sort === "recent" ? "text-ink" : "text-muted"}>
          Recent
        </Link>
        <Link to="/suggestions?sort=popular" className={loaderData.sort === "popular" ? "text-ink" : "text-muted"}>
          Popular
        </Link>
      </div>
      {loaderData.cards.length === 0 ? (
        <p className="text-muted">Nothing approved yet.</p>
      ) : (
        <ul className="grid gap-8">
          {loaderData.cards.map((card) => (
            <li key={card.id} className="border-t border-line pt-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-lg">{card.name ?? "Anonymous"}</p>
                {card.people ? <p className="text-sm text-muted">Suggested by {card.people} people</p> : null}
                {card.wornOn ? (
                  <Link to={`/outfits/${card.wornOn}`} className="text-sm text-rust">
                    Worn {formatDate(card.wornOn)}
                  </Link>
                ) : null}
              </div>
              {card.message ? <p className="mt-2 max-w-xl">{card.message}</p> : null}
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {card.pieces.map((piece) => (
                  <li key={piece.id}>
                    <Link to={`/items/${piece.id}`}>
                      <Photo item={piece} sizes="100px" />
                      <p className="mt-1 text-xs">{piece.name}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {loaderData.more ? (
        <Link to={`/suggestions?sort=${loaderData.sort}&page=${loaderData.page + 1}`} className="mt-8 inline-block text-rust">
          More
        </Link>
      ) : null}
    </div>
  );
}
