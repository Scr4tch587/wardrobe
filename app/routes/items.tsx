import { Link } from "react-router";
import type { Route } from "./+types/items";
import { Photo } from "../components/photo";
import { PageTitle } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { ItemsData } from "../lib/pages";
import { SLOTS, SLOT_LABEL } from "../lib/slots";

const SORTS = [
  ["name", "Name"],
  ["wears", "Most worn"],
  ["last_worn", "Last worn"],
  ["acquired", "Acquired"],
] as const;

export function meta({}: Route.MetaArgs) {
  return [{ title: "Items · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<ItemsData> {
  return callEdge(request, "items");
}

export default function Items({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle kicker="Catalog" title="Pieces" lede="Everything still in rotation." />
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Filter href="/items" active={!loaderData.slot}>
          All
        </Filter>
        {SLOTS.map((slot) => (
          <Filter key={slot} href={`/items?slot=${slot}&sort=${loaderData.sort}`} active={loaderData.slot === slot}>
            {SLOT_LABEL[slot]}
          </Filter>
        ))}
        <span className="mx-2 text-line">|</span>
        {SORTS.map(([sort, label]) => (
          <Filter
            key={sort}
            href={`/items?${loaderData.slot ? `slot=${loaderData.slot}&` : ""}sort=${sort}`}
            active={loaderData.sort === sort}
          >
            {label}
          </Filter>
        ))}
      </div>
      {loaderData.items.length === 0 ? (
        <p className="text-muted">Nothing in this slot yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {loaderData.items.map((item, index) => (
            <li key={item.id}>
              <Link to={`/items/${item.id}`} className="block">
                <Photo item={item} sizes="(min-width: 1024px) 220px, 45vw" lazy={index > 3} />
                <p className="mt-2">{item.name}</p>
                <p className="text-sm text-muted">
                  {SLOT_LABEL[item.slot]} · {item.wearCount} {item.wearCount === 1 ? "wear" : "wears"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Filter({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link to={href} className={active ? "rounded-full bg-ink px-3 py-1 text-paper" : "rounded-full px-3 py-1 text-muted"}>
      {children}
    </Link>
  );
}
