import { Form } from "react-router";
import type { Route } from "./+types/suggest";
import { Photo } from "../components/photo";
import { Notice, PageTitle } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { SuggestData } from "../lib/pages";
import { SLOTS, SLOT_LABEL, SUGGESTION_SLOT_RULES } from "../lib/slots";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Suggest · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<SuggestData> {
  return callEdge(request, "suggest");
}

export function action({ request }: Route.ActionArgs) {
  return callEdge(request, "suggest");
}

export default function Suggest({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle
        kicker={loaderData.feels == null ? "Today" : `Feels like ${loaderData.feels}°C`}
        title="Suggest an outfit"
        lede="A top, a bottom, and shoes. Outerwear and a couple of accessories if they earn it."
      />
      {loaderData.sent ? <Notice>Thanks, I'll review it soon.</Notice> : null}
      {actionData && "error" in actionData ? <p className="mb-4 text-rust">{actionData.error}</p> : null}
      <Form method="post" className="mt-6 grid gap-8">
        {SLOTS.map((slot) => {
          const rule = SUGGESTION_SLOT_RULES[slot];
          const pieces = loaderData.items.filter((item) => item.slot === slot);
          return (
            <fieldset key={slot}>
              <legend className="font-display text-2xl italic">
                {SLOT_LABEL[slot]}
                <span className="ml-2 text-sm not-italic text-muted">
                  {rule.min === rule.max ? rule.min : `${rule.min}–${rule.max}`}
                </span>
              </legend>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {pieces.map((item) => (
                  <li key={item.id}>
                    <label className="block">
                      <Photo item={item} sizes="160px" />
                      <span className="mt-2 flex items-start gap-2 text-sm">
                        <input type="checkbox" name="itemIds" value={item.id} className="mt-1" />
                        <span>
                          {item.name}
                          {loaderData.ranked.includes(item.id) ? (
                            <span className="mt-1 block text-xs uppercase tracking-wide text-rust">Fits today</span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
        <div className="grid max-w-xl gap-4">
          <label>
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Name</span>
            <input name="name" maxLength={40} className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2" />
          </label>
          <label>
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Note</span>
            <textarea name="message" maxLength={280} rows={3} className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2" />
          </label>
          <div className="cf-turnstile" data-sitekey={loaderData.siteKey} />
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <button type="submit" className="w-fit rounded-full bg-ink px-4 py-2 text-sm text-paper">
            Send suggestion
          </button>
        </div>
      </Form>
    </div>
  );
}
