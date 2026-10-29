import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const UploadRef = z.object({
  key: z.string().regex(/^(items|fits)\/[\w-]+\/[0-9a-f-]{36}$/),
  ext: z.enum(["webp", "jpg"]),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const ItemInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    slot: z.enum(["top", "bottom", "outerwear", "shoes", "accessory"]),
    color: z.string().trim().max(40).optional(),
    brand: z.string().trim().max(60).optional(),
    acquiredOn: isoDate.optional(),
    anecdote: z.string().trim().max(4000).optional(),
    tempMinC: z.coerce.number().min(-40).max(45).optional(),
    tempMaxC: z.coerce.number().min(-40).max(45).optional(),
    photo: UploadRef.optional(),
  })
  .refine((value) => value.tempMinC == null || value.tempMaxC == null || value.tempMinC < value.tempMaxC, {
    message: "The warm end of the range has to be above the cool end.",
    path: ["tempMaxC"],
  });

export const OutfitInput = z.object({
  date: isoDate,
  itemIds: z.array(z.string().uuid()).min(1).max(15),
  rating: z.coerce.number().int().min(1).max(10).optional(),
  note: z.string().trim().max(2000).optional(),
  fitPic: UploadRef.optional(),
  sourceSuggestionId: z.string().uuid().optional(),
});

export const SuggestionInput = z.object({
  itemIds: z.array(z.string().uuid()).min(3).max(7),
  name: z.string().optional(),
  message: z.string().optional(),
  turnstileToken: z.string().min(1),
});

export type ItemInput = z.infer<typeof ItemInput>;
export type OutfitInput = z.infer<typeof OutfitInput>;
export type UploadRef = z.infer<typeof UploadRef>;

function blank(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function uploadFrom(form: FormData, prefix: string): unknown {
  const key = blank(form.get(`${prefix}Key`));
  const ext = blank(form.get(`${prefix}Ext`));
  const w = blank(form.get(`${prefix}W`));
  const h = blank(form.get(`${prefix}H`));
  if (!key && !ext && !w && !h) return undefined;
  return { key, ext, w: w == null ? undefined : Number(w), h: h == null ? undefined : Number(h) };
}

export function parseItemForm(form: FormData) {
  return ItemInput.safeParse({
    name: form.get("name"),
    slot: form.get("slot"),
    color: blank(form.get("color")),
    brand: blank(form.get("brand")),
    acquiredOn: blank(form.get("acquiredOn")),
    anecdote: blank(form.get("anecdote")),
    tempMinC: blank(form.get("tempMinC")),
    tempMaxC: blank(form.get("tempMaxC")),
    photo: uploadFrom(form, "photo"),
  });
}

export function parseOutfitForm(form: FormData, date: string) {
  return OutfitInput.safeParse({
    date,
    itemIds: form.getAll("itemIds").map(String),
    rating: blank(form.get("rating")),
    note: blank(form.get("note")),
    fitPic: uploadFrom(form, "fitPic"),
    sourceSuggestionId: blank(form.get("sourceSuggestionId")),
  });
}

export function zodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}
