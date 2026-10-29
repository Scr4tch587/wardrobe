import { Form, Link } from "react-router";
import type { Route } from "./+types/admin.suggestions";
import { Photo } from "../components/photo";
import { PageTitle, formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { AdminSuggestionsData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Suggestions · Admin" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<AdminSuggestionsData> {
  return callEdge(request, "adminSuggestions");
}

export default function AdminSuggestions({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle kicker="Admin" title="Suggestions" />
      <div className="mb-6 flex gap-3 text-sm">
        {["pending", "approved", "rejected"].map((status) => (
          <Link key={status} to={`/admin/suggestions?status=${status}`} className={loaderData.status === status ? "text-ink" : "text-muted"}>
            {status}
          </Link>
        ))}
      </div>
      <ul className="space-y-8">
        {loaderData.suggestions.map((suggestion) => (
          <li key={suggestion.id} className="border-t border-line pt-6">
            <p className="text-sm text-muted">{new Date(suggestion.created_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })}</p>
            <p className="mt-1">{suggestion.name ?? "Anonymous"}</p>
            {suggestion.message ? <p className="mt-1">{suggestion.message}</p> : null}
            {suggestion.same > 0 ? <p className="mt-1 text-sm text-muted">{suggestion.same} approved with this combination</p> : null}
            <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {suggestion.pieces.map((piece) => (
                <li key={piece.id}>
                  <Photo
                    item={{
                      name: piece.name,
                      photoKey: piece.photo_key,
                      photoExt: piece.photo_ext === "webp" || piece.photo_ext === "jpg" ? piece.photo_ext : null,
                      photoW: piece.photo_w,
                      photoH: piece.photo_h,
                    }}
                    sizes="100px"
                  />
                  <p className="mt-1 text-xs">{piece.name}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {loaderData.status === "pending" ? (
                <Form method="post" action={`/admin/suggestions/${suggestion.id}`} className="flex flex-wrap gap-2">
                  <button name="intent" value="approve" className="rounded-full bg-ink px-3 py-1.5 text-sm text-paper">Approve</button>
                  <button name="intent" value="approve_hide_text" className="rounded-full border border-line px-3 py-1.5 text-sm">Approve, hide text</button>
                  <button name="intent" value="reject" className="rounded-full border border-line px-3 py-1.5 text-sm">Reject</button>
                  <button name="intent" value="block_ip" className="rounded-full border border-line px-3 py-1.5 text-sm">Block</button>
                </Form>
              ) : null}
              {loaderData.status === "approved" ? (
                <Link to={`/admin/outfits/${loaderData.today}?from_suggestion=${suggestion.id}`} className="text-sm text-rust">
                  Wear this on {formatDate(loaderData.today)}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
