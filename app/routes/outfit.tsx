import { Link } from "react-router";
import type { Route } from "./+types/outfit";
import { Photo } from "../components/photo";
import { formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { OutfitData } from "../lib/pages";
import { weatherLabel } from "../lib/weather-codes";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${formatDate(loaderData.outfit.date)} · Wardrobe` : "Outfit · Wardrobe" }];
}

export function loader({ request, params }: Route.LoaderArgs): Promise<OutfitData> {
  return callEdge(request, "outfit", params);
}

export default function OutfitPage({ loaderData }: Route.ComponentProps) {
  const { outfit, weather, suggestion } = loaderData;
  const feels = weather ? Math.round((weather.apparent_max_c + weather.apparent_min_c) / 2) : null;
  const sky = weatherLabel(weather?.weather_code ?? null);
  const showSuggestion = suggestion?.status === "approved" && suggestion.text_hidden === 0 && suggestion.name;
  return (
    <article className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
      <Photo
        item={{
          name: formatDate(outfit.date),
          photoKey: outfit.fitPicKey,
          photoExt: outfit.fitPicExt,
          photoW: outfit.fitPicW,
          photoH: outfit.fitPicH,
        }}
        sizes="(min-width: 1024px) 420px, 100vw"
        lazy={false}
      />
      <div>
        <h1 className="font-display text-5xl italic">{formatDate(outfit.date)}</h1>
        <p className="mt-2 text-muted">
          {outfit.rating ? `Rated ${outfit.rating} / 10` : "Unrated"}
          {feels == null ? "" : ` · feels like ${feels}°C`}
          {sky ? ` · ${sky}` : ""}
        </p>
        {outfit.note ? <p className="mt-6 max-w-xl whitespace-pre-wrap">{outfit.note}</p> : null}
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {outfit.items.map((item) => (
            <li key={item.id}>
              <Link to={`/items/${item.id}`}>
                <Photo item={item} sizes="160px" />
                <p className="mt-2 text-sm">{item.name}</p>
              </Link>
            </li>
          ))}
        </ul>
        {showSuggestion ? (
          <p className="mt-8 text-sm text-muted">
            Suggested by {suggestion?.name}
            {suggestion?.message ? ` — ${suggestion.message}` : ""}
          </p>
        ) : null}
      </div>
    </article>
  );
}
