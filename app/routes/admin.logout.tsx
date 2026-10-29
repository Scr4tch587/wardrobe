import { redirect } from "react-router";
import type { Route } from "./+types/admin.logout";
import { callEdge } from "../lib/edge.server";

export function loader() {
  throw redirect("/admin");
}

export function action({ request }: Route.ActionArgs) {
  return callEdge(request, "logout");
}

export default function Logout() {
  return null;
}
