import { Link } from "react-router";
import type { Route } from "./+types/item";
import { Heatmap } from "../components/charts";
import { Photo } from "../components/photo";
import { formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { ItemData } from "../lib/pages";
import { SLOT_LABEL, isSlot } from "../lib/slots";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.item.name} · Wardrobe` : "Item · Wardrobe" }];
}

export function loader({ request, params }: Route.LoaderArgs): Promise<ItemData> {
  return callEdge(request, "item", params);
}

export default function ItemPage({ loaderData }: Route.ComponentProps) {
  const { item } = loaderData;
  const slot = isSlot(item.slot) ? SLOT_LABEL[item.slot] : item.slot;
  return (
    <article className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <Photo item={item} sizes="(min-width: 1024px) 420px, 100vw" lazy={false} />
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">
          {slot}
          {item.archivedAt ? " · Retired" : ""}
        </p>
        <h1 className="mt-2 font-display text-5xl italic leading-none">{item.name}</h1>
        <p className="mt-3 text-muted">
          {[item.color, item.brand, item.acquiredOn ? `since ${formatDate(item.acquiredOn)}` : null]
            .filter(Boolean)
            .join(" · ") || "No extra details"}
        </p>
        {item.anecdote ? (
          <div className="mt-6 space-y-3">
            {item.anecdote.split(/\n+/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : null}
        <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Wears" value={String(item.wearCount)} />
          <Stat label="Last worn" value={item.lastWorn ? formatDate(item.lastWorn) : "Never"} />
          <Stat label="Rating" value={item.avgRating == null ? "—" : item.avgRating.toFixed(1)} />
          <Stat
            label="Worn around"
            value={item.avgWornTemp == null ? "—" : `${Math.round(item.avgWornTemp)}°C`}
          />
        </dl>
        <section className="mt-10">
          <h2 className="font-display text-2xl italic">Wear calendar</h2>
          <div className="mt-3">
            <Heatmap dates={loaderData.dates} cutoff={loaderData.cutoff} />
          </div>
        </section>
        {loaderData.withItems.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-2xl italic">Often worn with</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {loaderData.withItems.map((other) => (
                <li key={other.other_id}>
                  <Link to={`/items/${other.other_id}`}>
                    <Photo
                      item={{
                        name: other.name,
                        photoKey: other.photo_key,
                        photoExt: other.photo_ext === "webp" || other.photo_ext === "jpg" ? other.photo_ext : null,
                        photoW: other.photo_w,
                        photoH: other.photo_h,
                      }}
                      sizes="120px"
                    />
                    <p className="mt-1 text-sm">{other.name}</p>
                    <p className="text-xs text-muted">{other.together} together</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {loaderData.outfits.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-2xl italic">Outfits</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {loaderData.outfits.map((outfit) => (
                <li key={outfit.date}>
                  <Link to={`/outfits/${outfit.date}`} className="text-rust">
                    {formatDate(outfit.date)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-display text-2xl italic">{value}</dd>
    </div>
  );
}
