import { Link } from "react-router";
import type { Route } from "./+types/admin.items";
import { PageTitle } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { AdminItemsData } from "../lib/pages";
import { SLOT_LABEL, isSlot } from "../lib/slots";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Pieces · Admin" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<AdminItemsData> {
  return callEdge(request, "adminItems");
}

export default function AdminItems({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle kicker="Admin" title="Pieces" />
      <Link to="/admin/items/new" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
        New piece
      </Link>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {loaderData.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between py-3">
            <Link to={`/admin/items/${item.id}`}>{item.name}</Link>
            <span className="text-sm text-muted">
              {isSlot(item.slot) ? SLOT_LABEL[item.slot] : item.slot}
              {item.archived_at ? " · Retired" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
