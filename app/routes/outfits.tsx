import { Link } from "react-router";
import type { Route } from "./+types/outfits";
import { Photo } from "../components/photo";
import { PageTitle, formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { OutfitsData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Outfits · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<OutfitsData> {
  return callEdge(request, "outfits");
}

export default function Outfits({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle kicker="Log" title="Outfits" lede="One a day, published the day after." />
      {loaderData.outfits.length === 0 ? (
        <p className="text-muted">No outfits yet.</p>
      ) : (
        <ol className="grid gap-8">
          {loaderData.outfits.map((outfit) => (
            <li key={outfit.date} className="grid gap-4 border-t border-line pt-6 sm:grid-cols-[180px_1fr]">
              <Link to={`/outfits/${outfit.date}`}>
                <Photo
                  item={{
                    name: formatDate(outfit.date),
                    photoKey: outfit.fitPicKey,
                    photoExt: outfit.fitPicExt,
                    photoW: outfit.fitPicW,
                    photoH: outfit.fitPicH,
                  }}
                  sizes="180px"
                />
              </Link>
              <div>
                <Link to={`/outfits/${outfit.date}`} className="font-display text-3xl italic">
                  {formatDate(outfit.date)}
                </Link>
                <p className="mt-1 text-sm text-muted">{outfit.rating ? `Rated ${outfit.rating}` : "Unrated"}</p>
                <p className="mt-3">{outfit.items.map((item) => item.name).join(", ")}</p>
                {outfit.note ? <p className="mt-2 text-muted">{outfit.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {loaderData.next ? (
        <Link to={`/outfits?before=${loaderData.next}`} className="mt-8 inline-block text-rust">
          Older outfits
        </Link>
      ) : null}
    </div>
  );
}
