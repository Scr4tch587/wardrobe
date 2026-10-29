import type { Route } from "./+types/admin.items.new";
import { ItemForm } from "../components/item-form";
import { PageTitle } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { AdminNewItemData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "New piece · Admin" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<AdminNewItemData> {
  return callEdge(request, "adminItemNew");
}

export function action({ request }: Route.ActionArgs) {
  return callEdge(request, "adminItemNew");
}

export default function NewItem({ loaderData, actionData }: Route.ComponentProps) {
  const values = actionData && "values" in actionData ? actionData.values : {};
  return (
    <div>
      <PageTitle kicker="Admin" title="New piece" />
      <ItemForm
        error={actionData && "error" in actionData ? actionData.error : undefined}
        values={{
          id: actionData && "id" in actionData ? String(actionData.id) : loaderData.id,
          name: stringValue(values, "name"),
          slot: stringValue(values, "slot"),
          color: stringValue(values, "color"),
          brand: stringValue(values, "brand"),
          acquiredOn: stringValue(values, "acquiredOn"),
          anecdote: stringValue(values, "anecdote"),
          tempMinC: stringValue(values, "tempMinC"),
          tempMaxC: stringValue(values, "tempMaxC"),
        }}
      />
    </div>
  );
}

function stringValue(values: object | undefined, key: string): string {
  if (!values || !(key in values)) return "";
  const value = (values as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
