import type { Route } from "./+types/outfits-random";
import { callEdge } from "../lib/edge.server";

export function loader({ request }: Route.LoaderArgs) {
  return callEdge(request, "outfitsRandom");
}

export default function RandomOutfit() {
  return null;
}
