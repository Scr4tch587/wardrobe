import type { Route } from "./+types/admin.setup.passkey";
import { callEdge } from "../lib/edge.server";

export function action({ request }: Route.ActionArgs) {
  return callEdge(request, "setupPasskey");
}
