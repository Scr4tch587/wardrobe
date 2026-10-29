import { Link } from "react-router";
import type { Route } from "./+types/home";
import { Photo } from "../components/photo";
import { formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { HomeData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Wardrobe" }, { name: "description", content: "What to wear, and what has been worn." }];
}

export function loader({ request }: Route.LoaderArgs): Promise<HomeData> {
  return callEdge(request, "home");
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const temp = loaderData.entries[0]?.temp;
  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{formatDate(loaderData.today)}</p>
          <h1 className="mt-3 max-w-xl font-display text-6xl italic leading-[0.95] tracking-tight">
            {temp == null ? "Wear something you miss." : `It feels like ${Math.round(temp)}° today.`}
          </h1>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/outfits/random" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
              Surprise me
            </Link>
            <Link to="/suggest" className="rounded-full border border-line px-4 py-2 text-sm">
              Suggest an outfit
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-muted">Outfits</dt>
            <dd className="font-display text-3xl italic">{loaderData.outfitCount}</dd>
          </div>
          <div>
            <dt className="text-muted">Avg rating</dt>
            <dd className="font-display text-3xl italic">
              {loaderData.avgRating == null ? "—" : loaderData.avgRating.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Streak</dt>
            <dd className="font-display text-3xl italic">{loaderData.streak.current}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="font-display text-3xl italic">Should wear</h2>
        {loaderData.entries.length === 0 ? (
          <p className="mt-4 text-muted">The daily ranking hasn't been run yet.</p>
        ) : (
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {loaderData.entries.map((entry) => (
              <li key={entry.id}>
                <Link to={`/items/${entry.id}`} className="block">
                  <Photo item={{ ...entry, name: entry.name }} sizes="180px" />
                  <p className="mt-2 font-medium">{entry.name}</p>
                  <p className="text-sm text-muted">{entry.score.toFixed(2)}</p>
                  <p className="mt-1 text-sm text-muted">{entry.explanation}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-3xl italic">Recently worn</h2>
          <Link to="/outfits" className="text-sm text-rust">
            All outfits
          </Link>
        </div>
        {loaderData.outfits.length === 0 ? (
          <p className="mt-4 text-muted">Nothing published yet.</p>
        ) : (
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loaderData.outfits.map((outfit) => (
              <li key={outfit.date}>
                <Link to={`/outfits/${outfit.date}`} className="block">
                  <Photo
                    item={{
                      name: formatDate(outfit.date),
                      photoKey: outfit.fitPicKey,
                      photoExt: outfit.fitPicExt,
                      photoW: outfit.fitPicW,
                      photoH: outfit.fitPicH,
                    }}
                    sizes="240px"
                  />
                  <p className="mt-2">{formatDate(outfit.date)}</p>
                  <p className="text-sm text-muted">{outfit.items.map((item) => item.name).join(", ")}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
