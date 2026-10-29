import { Form } from "react-router";
import { PhotoField } from "./photo-field";
import { Field, PrimaryButton, controlClass } from "./ui";
import { SLOTS, SLOT_LABEL } from "../lib/slots";

export type ItemFormValues = {
  id: string;
  name?: string;
  slot?: string;
  color?: string;
  brand?: string;
  acquiredOn?: string;
  anecdote?: string;
  tempMinC?: string | number | null;
  tempMaxC?: string | number | null;
  photoKey?: string | null;
  photoExt?: string | null;
  photoW?: number | null;
  photoH?: number | null;
};

export function ItemForm({ values, error }: { values: ItemFormValues; error?: string }) {
  const photo =
    values.photoKey && values.photoExt && values.photoW && values.photoH
      ? { key: values.photoKey, ext: values.photoExt, w: values.photoW, h: values.photoH }
      : null;
  return (
    <Form method="post" className="grid max-w-xl gap-4">
      {error ? <p className="rounded-2xl bg-[#f3ddd4] px-4 py-3 text-sm">{error}</p> : null}
      <input type="hidden" name="id" value={values.id} />
      <input type="hidden" name="intent" value="save" />
      <Field label="Name">
        <input className={controlClass} name="name" required maxLength={80} defaultValue={values.name ?? ""} />
      </Field>
      <Field label="Slot">
        <select className={controlClass} name="slot" defaultValue={values.slot ?? "top"}>
          {SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {SLOT_LABEL[slot]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Color">
          <input className={controlClass} name="color" maxLength={40} defaultValue={values.color ?? ""} />
        </Field>
        <Field label="Brand">
          <input className={controlClass} name="brand" maxLength={60} defaultValue={values.brand ?? ""} />
        </Field>
      </div>
      <Field label="Acquired">
        <input className={controlClass} type="date" name="acquiredOn" defaultValue={values.acquiredOn ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coolest it suits, °C">
          <input className={controlClass} name="tempMinC" inputMode="decimal" defaultValue={values.tempMinC ?? ""} />
        </Field>
        <Field label="Warmest it suits, °C">
          <input className={controlClass} name="tempMaxC" inputMode="decimal" defaultValue={values.tempMaxC ?? ""} />
        </Field>
      </div>
      <Field label="Anecdote">
        <textarea className={controlClass} name="anecdote" rows={5} maxLength={4000} defaultValue={values.anecdote ?? ""} />
      </Field>
      <Field label="Photo">
        <PhotoField prefix="photo" kind="item" owner={values.id} existing={photo} />
      </Field>
      <PrimaryButton>Save piece</PrimaryButton>
    </Form>
  );
}
