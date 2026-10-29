import type { Route } from "./+types/admin.login.passkey";
import { callEdge } from "../lib/edge.server";

export function action({ request }: Route.ActionArgs) {
  return callEdge(request, "loginPasskey");
}
