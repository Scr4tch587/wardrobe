import { Form, Link } from "react-router";
import type { Route } from "./+types/admin";
import { PageTitle, formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { AdminHomeData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<AdminHomeData> {
  return callEdge(request, "admin");
}

export function action({ request }: Route.ActionArgs) {
  return callEdge(request, "admin");
}

export default function AdminHome({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle kicker="Admin" title={formatDate(loaderData.today)} />
      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        <Link to="/admin/items">Pieces</Link>
        <Link to={`/admin/outfits/${loaderData.today}`}>Today's outfit</Link>
        <Link to="/admin/suggestions">Suggestions ({loaderData.pending})</Link>
        <Form method="post" action="/admin/logout">
          <button className="text-muted">Sign out</button>
        </Form>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <p className="rounded-2xl border border-line bg-card p-4">
          {loaderData.logged ? "Today's outfit is logged." : "Today's outfit is still open."}
        </p>
        <p className="rounded-2xl border border-line bg-card p-4">{loaderData.pending} suggestions waiting.</p>
        <p className="rounded-2xl border border-line bg-card p-4">
          {loaderData.run
            ? `Last ranking ${loaderData.run.date}: ${loaderData.run.status} at ${new Date(loaderData.run.computed_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })}`
            : "No ranking has run yet."}
        </p>
      </div>
      {loaderData.ran ? <p className="mt-4 text-sm text-moss">Daily job finished.</p> : null}
      <Form method="post" className="mt-6">
        <button name="intent" value="rerun_daily" className="rounded-full border border-line px-4 py-2 text-sm">
          Re-run now
        </button>
      </Form>
    </div>
  );
}
