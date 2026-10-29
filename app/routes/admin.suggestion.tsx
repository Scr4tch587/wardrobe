import type { Route } from "./+types/admin.suggestion";
import { callEdge } from "../lib/edge.server";

export function loader({ request }: Route.LoaderArgs) {
  return callEdge(request, "adminSuggestion");
}

export function action({ request, params }: Route.ActionArgs) {
  return callEdge(request, "adminSuggestion", params);
}

export default function SuggestionAction() {
  return null;
}
