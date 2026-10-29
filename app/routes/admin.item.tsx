import { Form } from "react-router";
import type { Route } from "./+types/admin.item";
import { ItemForm } from "../components/item-form";
import { PageTitle } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { AdminItemData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Edit piece · Admin" }];
}

export function loader({ request, params }: Route.LoaderArgs): Promise<AdminItemData> {
  return callEdge(request, "adminItem", params);
}

export function action({ request, params }: Route.ActionArgs) {
  return callEdge(request, "adminItem", params);
}

export default function EditItem({ loaderData, actionData }: Route.ComponentProps) {
  const item = loaderData.item;
  return (
    <div>
      <PageTitle kicker="Admin" title={item.name} />
      <ItemForm
        error={actionData && "error" in actionData ? actionData.error : undefined}
        values={{
          id: item.id,
          name: item.name,
          slot: item.slot,
          color: item.color ?? "",
          brand: item.brand ?? "",
          acquiredOn: item.acquiredOn ?? "",
          anecdote: item.anecdote ?? "",
          tempMinC: item.tempMinC,
          tempMaxC: item.tempMaxC,
          photoKey: item.photoKey,
          photoExt: item.photoExt,
          photoW: item.photoW,
          photoH: item.photoH,
        }}
      />
      <div className="mt-8 flex gap-3">
        <Form method="post">
          <button name="intent" value={item.archivedAt ? "unarchive" : "archive"} className="rounded-full border border-line px-4 py-2 text-sm">
            {item.archivedAt ? "Restore" : "Retire"}
          </button>
        </Form>
        <Form method="post">
          <button name="intent" value="delete" className="rounded-full border border-line px-4 py-2 text-sm">
            Delete
          </button>
        </Form>
      </div>
    </div>
  );
}
