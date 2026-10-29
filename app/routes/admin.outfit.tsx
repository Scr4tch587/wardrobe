import { Form } from "react-router";
import type { Route } from "./+types/admin.outfit";
import { PhotoField } from "../components/photo-field";
import { PageTitle, PrimaryButton, controlClass, formatDate } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { AdminOutfitData } from "../lib/pages";
import { SLOTS, SLOT_LABEL } from "../lib/slots";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Outfit · Admin" }];
}

export function loader({ request, params }: Route.LoaderArgs): Promise<AdminOutfitData> {
  return callEdge(request, "adminOutfit", params);
}

export function action({ request, params }: Route.ActionArgs) {
  return callEdge(request, "adminOutfit", params);
}

export default function AdminOutfit({ loaderData, actionData }: Route.ComponentProps) {
  const future = loaderData.date > loaderData.today;
  return (
    <div>
      <PageTitle kicker="Admin" title={formatDate(loaderData.date)} />
      {future ? <p className="mb-4 text-rust">That date hasn't happened yet.</p> : null}
      {actionData && "error" in actionData ? <p className="mb-4 text-rust">{actionData.error}</p> : null}
      <Form method="post" className="grid max-w-3xl gap-6">
        <input type="hidden" name="intent" value="save" />
        {loaderData.source ? <input type="hidden" name="sourceSuggestionId" value={loaderData.source} /> : null}
        {SLOTS.map((slot) => (
          <fieldset key={slot}>
            <legend className="font-display text-2xl italic">{SLOT_LABEL[slot]}</legend>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {loaderData.items
                .filter((item) => item.slot === slot)
                .map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="itemIds" value={item.id} defaultChecked={loaderData.selected.includes(item.id)} />
                      {item.name}
                      {item.archived_at ? <span className="text-muted">Retired</span> : null}
                    </label>
                  </li>
                ))}
            </ul>
          </fieldset>
        ))}
        <label>
          <span className="text-xs uppercase tracking-[0.14em] text-muted">Rating</span>
          <select className={controlClass} name="rating" defaultValue={loaderData.outfit?.rating ?? ""}>
            <option value="">No rating</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs uppercase tracking-[0.14em] text-muted">Note</span>
          <textarea className={controlClass} name="note" rows={4} maxLength={2000} defaultValue={loaderData.outfit?.note ?? ""} />
        </label>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Fit pic</p>
          <div className="mt-1.5">
            <PhotoField
              prefix="fitPic"
              kind="fit"
              owner={loaderData.date}
              existing={
                loaderData.outfit?.fit_pic_key && loaderData.outfit.fit_pic_ext && loaderData.outfit.fit_pic_w && loaderData.outfit.fit_pic_h
                  ? {
                      key: loaderData.outfit.fit_pic_key,
                      ext: loaderData.outfit.fit_pic_ext,
                      w: loaderData.outfit.fit_pic_w,
                      h: loaderData.outfit.fit_pic_h,
                    }
                  : null
              }
            />
          </div>
        </div>
        <PrimaryButton>Save outfit</PrimaryButton>
      </Form>
      {loaderData.outfit ? (
        <Form method="post" className="mt-4">
          <button name="intent" value="delete" className="text-sm text-muted">
            Delete this outfit
          </button>
        </Form>
      ) : null}
    </div>
  );
}
