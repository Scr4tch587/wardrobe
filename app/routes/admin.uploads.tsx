import type { Route } from "./+types/admin.uploads";
import { callEdge } from "../lib/edge.server";

export function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export function action({ request }: Route.ActionArgs) {
  return callEdge(request, "upload");
}
