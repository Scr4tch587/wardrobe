import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { data, redirect } from "react-router";
import {
  assertAdminOrigin,
  beginLogin,
  beginRegistration,
  finishLogin,
  finishRegistration,
  guardAdmin,
  hasAdminSession,
  logout,
  registrationAllowed,
} from "./auth.server";
import { runDaily } from "./daily.server";
import { addDays, daysBetween, publishCutoff } from "./dates";
import { getDb } from "./db.server";
import { deleteItem, saveItem, setArchived } from "./items.server";
import { contentTypeFor, deleteImage, sniffImage } from "./media.server";
import { deleteOutfit, saveOutfit } from "./outfits.server";
import {
  concentration,
  getItem,
  getOutfit,
  leaderboard,
  listActiveItems,
  listOutfits,
  outfitDates,
  pairings,
  ranksFor,
  wearDates,
  streaks,
  weatherFor,
  latestRun,
  type ItemCard,
} from "./queries.server";
import { explainScore } from "./ranking";
import { items } from "./schema";
import { isoDate, parseItemForm, parseOutfitForm, zodError, type ItemInput, type OutfitInput } from "./schemas";
import { isSlot, SLOTS, SLOT_LABEL } from "./slots";
import { submitSuggestion } from "./suggestions.server";

type Params = Record<string, string | undefined>;
type Handler = (request: Request, env: Env, params: Params) => Promise<unknown>;

const MAX_BYTES = 1.5 * 1024 * 1024;

export async function dispatch(op: string, request: Request, env: Env, params: Params): Promise<unknown> {
  const handler = handlers[op];
  if (!handler) throw data("Not found", { status: 404 });
  return handler(request, env, params);
}

const handlers: Record<string, Handler> = {
  home: loadHome,
  items: loadItems,
  item: loadItem,
  outfits: loadOutfits,
  outfitsRandom: loadRandomOutfit,
  outfit: loadOutfit,
  leaderboard: loadLeaderboard,
  stats: loadStats,
  suggest: handleSuggest,
  suggestions: loadSuggestions,
  admin: handleAdmin,
  adminItems: loadAdminItems,
  adminItemNew: handleAdminItemNew,
  adminItem: handleAdminItem,
  adminOutfit: handleAdminOutfit,
  adminSuggestions: loadAdminSuggestions,
  adminSuggestion: handleAdminSuggestion,
  adminLogin: loadAdminLogin,
  loginPasskey: handleLoginPasskey,
  adminSetup: loadAdminSetup,
  setupPasskey: handleSetupPasskey,
  logout: handleLogout,
  upload: handleUpload,
};

async function loadHome(_request: Request, env: Env) {
  const { today, cutoff } = publishCutoff(env);
  const [board, outfits, dates, catalog, summary] = await Promise.all([
    leaderboard(env, today, 5),
    listOutfits(env, cutoff, null, 7),
    outfitDates(env, cutoff),
    listActiveItems(env, cutoff),
    env.DB.prepare("SELECT COUNT(*) AS outfits, AVG(rating) AS rating FROM outfits WHERE date <= ?")
      .bind(cutoff)
      .first<{ outfits: number; rating: number | null }>(),
  ]);
  const stats = new Map(catalog.map((item) => [item.id, item]));
  return {
    today,
    outfits,
    streak: streaks(dates, cutoff),
    outfitCount: summary?.outfits ?? 0,
    avgRating: summary?.rating ?? null,
    entries: board.map((row) => {
      const item = stats.get(row.item_id);
      return {
        id: row.item_id,
        name: row.name,
        score: row.score,
        photoKey: row.photo_key,
        photoExt: photoExt(row.photo_ext),
        photoW: row.photo_w,
        photoH: row.photo_h,
        temp: row.effective_temp,
        explanation: explainScore({
          lastWorn: item?.lastWorn ?? null,
          today,
          effectiveTemp: row.effective_temp,
          seasonFit: row.season_fit,
          ratedCount: item?.ratedCount ?? 0,
          shrunkRating: row.enjoyment * 9 + 1,
        }),
      };
    }),
  };
}

async function loadItems(request: Request, env: Env) {
  const { cutoff } = publishCutoff(env);
  const url = new URL(request.url);
  const slot = url.searchParams.get("slot");
  const sort = url.searchParams.get("sort") ?? "name";
  let catalog = await listActiveItems(env, cutoff);
  if (slot && isSlot(slot)) catalog = catalog.filter((item) => item.slot === slot);
  catalog.sort((a, b) => compareItems(a, b, sort));
  return { items: catalog, slot, sort };
}

async function loadItem(_request: Request, env: Env, params: Params) {
  const id = required(params, "id");
  const { cutoff } = publishCutoff(env);
  const item = await getItem(env, id, cutoff);
  if (!item) throw data("Not found", { status: 404 });
  const [dates, withItems, outfits] = await Promise.all([
    wearDates(env, item.id, cutoff),
    pairings(env, item.id, cutoff),
    env.DB.prepare(
      `SELECT o.date AS date FROM outfits o
       JOIN outfit_items oi ON oi.date = o.date
       WHERE oi.item_id = ? AND o.date <= ?
       ORDER BY o.date DESC LIMIT 12`,
    )
      .bind(item.id, cutoff)
      .all<{ date: string }>(),
  ]);
  return { item, dates, cutoff, withItems, outfits: outfits.results };
}

async function loadOutfits(request: Request, env: Env) {
  const { cutoff } = publishCutoff(env);
  const beforeParam = new URL(request.url).searchParams.get("before");
  const before = beforeParam && isoDate.safeParse(beforeParam).success ? beforeParam : null;
  const outfits = await listOutfits(env, cutoff, before, 30);
  return { outfits, next: outfits.length === 30 ? outfits[outfits.length - 1]?.date : null };
}

async function loadRandomOutfit(_request: Request, env: Env) {
  const { cutoff } = publishCutoff(env);
  const row = await env.DB.prepare("SELECT date FROM outfits WHERE date <= ? ORDER BY random() LIMIT 1")
    .bind(cutoff)
    .first<{ date: string }>();
  const headers = { "Cache-Control": "no-store" };
  if (!row) return redirect("/outfits", { headers });
  return redirect(`/outfits/${row.date}`, { headers });
}

async function loadOutfit(_request: Request, env: Env, params: Params) {
  const date = required(params, "date");
  if (!isoDate.safeParse(date).success) throw data("Not found", { status: 404 });
  const { cutoff } = publishCutoff(env);
  if (date > cutoff) throw data("Not found", { status: 404 });
  const outfit = await getOutfit(env, date);
  if (!outfit) throw data("Not found", { status: 404 });
  const weather = await weatherFor(env, outfit.date);
  const suggestion = outfit.sourceSuggestionId
    ? await env.DB.prepare("SELECT name, message, status, text_hidden FROM suggestions WHERE id = ?")
        .bind(outfit.sourceSuggestionId)
        .first<{ name: string | null; message: string | null; status: string; text_hidden: number }>()
    : null;
  return { outfit, weather, suggestion };
}

async function loadLeaderboard(_request: Request, env: Env) {
  const { today, cutoff } = publishCutoff(env);
  const [board, catalog, yesterday] = await Promise.all([
    leaderboard(env, today, 20),
    listActiveItems(env, cutoff),
    ranksFor(env, addDays(today, -1)),
  ]);
  const stats = new Map(catalog.map((item) => [item.id, item]));
  return {
    today,
    entries: board.map((row) => {
      const item = stats.get(row.item_id);
      const previous = yesterday.get(row.item_id);
      const delta = previous == null ? null : previous - row.rank;
      return {
        id: row.item_id,
        name: row.name,
        rank: row.rank,
        score: row.score,
        photoKey: row.photo_key,
        photoExt: photoExt(row.photo_ext),
        photoW: row.photo_w,
        photoH: row.photo_h,
        movement: previous == null ? "new" : delta === 0 ? "–" : delta! > 0 ? `↑${delta}` : `↓${-delta!}`,
        explanation: explainScore({
          lastWorn: item?.lastWorn ?? null,
          today,
          effectiveTemp: row.effective_temp,
          seasonFit: row.season_fit,
          ratedCount: item?.ratedCount ?? 0,
          shrunkRating: row.enjoyment * 9 + 1,
        }),
      };
    }),
  };
}

async function loadStats(_request: Request, env: Env) {
  const { cutoff } = publishCutoff(env);
  const [catalog, dates, summary, visitor, temps, slotWears] = await Promise.all([
    listActiveItems(env, cutoff),
    outfitDates(env, cutoff),
    env.DB.prepare(
      "SELECT COUNT(*) AS outfits, AVG(rating) AS rating FROM outfits WHERE date <= ? AND rating IS NOT NULL",
    )
      .bind(cutoff)
      .first<{ outfits: number; rating: number | null }>(),
    env.DB.prepare(
      `SELECT (source_suggestion_id IS NOT NULL) AS from_visitor, COUNT(*) AS outfits, AVG(rating) AS avg_rating
       FROM outfits WHERE date <= ? AND rating IS NOT NULL GROUP BY from_visitor`,
    )
      .bind(cutoff)
      .all<{ from_visitor: number; outfits: number; avg_rating: number | null }>(),
    env.DB.prepare(
      `SELECT o.rating AS rating, (w.apparent_max_c + w.apparent_min_c) / 2.0 AS temp
       FROM outfits o
       JOIN weather w ON w.date = o.date AND w.kind = 'actual'
       WHERE o.date <= ? AND o.rating IS NOT NULL`,
    )
      .bind(cutoff)
      .all<{ rating: number; temp: number }>(),
    env.DB.prepare(
      `SELECT i.slot AS slot, COUNT(oi.date) AS wears
       FROM outfit_items oi JOIN items i ON i.id = oi.item_id
       WHERE oi.date <= ? GROUP BY i.slot`,
    )
      .bind(cutoff)
      .all<{ slot: string; wears: number }>(),
  ]);
  const allOutfits = await env.DB.prepare("SELECT COUNT(*) AS n FROM outfits WHERE date <= ?")
    .bind(cutoff)
    .first<{ n: number }>();
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const row of temps.results) {
    const bucket = Math.floor(row.temp / 5) * 5;
    const current = buckets.get(bucket) ?? { sum: 0, n: 0 };
    current.sum += row.rating;
    current.n += 1;
    buckets.set(bucket, current);
  }
  const dormant = catalog
    .filter((item) => !item.lastWorn || daysBetween(item.lastWorn, cutoff) > 90)
    .sort((a, b) => {
      if (!a.lastWorn && !b.lastWorn) return a.createdAt - b.createdAt;
      if (!a.lastWorn) return -1;
      if (!b.lastWorn) return 1;
      return a.lastWorn < b.lastWorn ? -1 : 1;
    });
  const wearsBySlot = new Map(slotWears.results.map((row) => [row.slot, row.wears]));
  return {
    cutoff,
    total: allOutfits?.n ?? 0,
    avgRating: summary?.rating ?? null,
    rated: summary?.outfits ?? 0,
    streak: streaks(dates, cutoff),
    concentration: concentration(catalog.map((item) => item.wearCount)),
    dormant: dormant.slice(0, 12).map((item) => ({
      id: item.id,
      name: item.name,
      lastWorn: item.lastWorn,
    })),
    slots: SLOTS.map((slot) => ({ label: SLOT_LABEL[slot], value: wearsBySlot.get(slot) ?? 0 })),
    temps: [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, value]) => ({
        label: `${bucket}–${bucket + 5}°C`,
        value: value.sum / value.n,
        note: value.sum / value.n >= 0 ? (value.sum / value.n).toFixed(1) : "",
      })),
    visitor: visitor.results.map((row) => ({
      label: row.from_visitor ? "Visitor suggestions" : "Own picks",
      outfits: row.outfits,
      rating: row.avg_rating,
    })),
  };
}

async function handleSuggest(request: Request, env: Env) {
  if (request.method === "POST") {
    const form = await request.formData();
    const result = await submitSuggestion(env, request, {
      itemIds: form.getAll("itemIds").map(String),
      name: String(form.get("name") ?? ""),
      message: String(form.get("message") ?? ""),
      turnstileToken: String(form.get("cf-turnstile-response") ?? ""),
    });
    if (!result.ok) return data({ error: result.error }, { status: result.status });
    return redirect("/suggest?sent=1");
  }
  const { today, cutoff } = publishCutoff(env);
  const [catalog, board, weather] = await Promise.all([
    listActiveItems(env, cutoff),
    leaderboard(env, today, 10),
    weatherFor(env, today),
  ]);
  return {
    items: catalog,
    ranked: board.map((row) => row.item_id),
    feels: weather ? Math.round((weather.apparent_max_c + weather.apparent_min_c) / 2) : null,
    siteKey: env.TURNSTILE_SITE_KEY,
    sent: new URL(request.url).searchParams.get("sent") === "1",
  };
}

async function loadSuggestions(request: Request, env: Env) {
  const { cutoff } = publishCutoff(env);
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") === "popular" ? "popular" : "recent";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const offset = (page - 1) * 20;
  const wornRows = await env.DB.prepare(
    `SELECT source_suggestion_id AS id, MAX(date) AS date
     FROM outfits WHERE date <= ? AND source_suggestion_id IS NOT NULL
     GROUP BY source_suggestion_id`,
  )
    .bind(cutoff)
    .all<{ id: string; date: string }>();
  const worn = new Map(wornRows.results.map((row) => [row.id, row.date]));
  const wornCombos = await env.DB.prepare(
    `SELECT s.combo_key AS combo_key, MAX(o.date) AS date
     FROM outfits o JOIN suggestions s ON s.id = o.source_suggestion_id
     WHERE o.date <= ? GROUP BY s.combo_key`,
  )
    .bind(cutoff)
    .all<{ combo_key: string; date: string }>();
  const wornByCombo = new Map(wornCombos.results.map((row) => [row.combo_key, row.date]));

  if (sort === "popular") {
    const groups = await env.DB.prepare(
      `WITH counts AS (
         SELECT combo_key, COUNT(*) AS people FROM suggestions WHERE status = 'approved' GROUP BY combo_key
       ),
       latest AS (
         SELECT id, combo_key, created_at, ROW_NUMBER() OVER (PARTITION BY combo_key ORDER BY created_at DESC) AS rn
         FROM suggestions WHERE status = 'approved'
       ),
       visible AS (
         SELECT combo_key, name, message,
                ROW_NUMBER() OVER (PARTITION BY combo_key ORDER BY created_at DESC) AS rn
         FROM suggestions
         WHERE status = 'approved' AND text_hidden = 0 AND name IS NOT NULL AND message IS NOT NULL
       )
       SELECT c.combo_key, c.people, l.id AS id, v.name AS name, v.message AS message
       FROM counts c
       JOIN latest l ON l.combo_key = c.combo_key AND l.rn = 1
       LEFT JOIN visible v ON v.combo_key = c.combo_key AND v.rn = 1
       ORDER BY c.people DESC, l.id
       LIMIT 20 OFFSET ?`,
    )
      .bind(offset)
      .all<{ combo_key: string; people: number; id: string; name: string | null; message: string | null }>();
    const cards = await withPieces(
      env,
      groups.results.map((row) => ({
        id: row.id,
        name: row.name,
        message: row.message,
        people: row.people,
        wornOn: wornByCombo.get(row.combo_key) ?? null,
      })),
    );
    return { sort, page, cards, more: groups.results.length === 20 };
  }

  const rows = await env.DB.prepare(
    `SELECT id, name, message, text_hidden, created_at
     FROM suggestions WHERE status = 'approved'
     ORDER BY created_at DESC LIMIT 20 OFFSET ?`,
  )
    .bind(offset)
    .all<{ id: string; name: string | null; message: string | null; text_hidden: number; created_at: number }>();
  const cards = await withPieces(
    env,
    rows.results.map((row) => ({
      id: row.id,
      name: row.text_hidden || !row.name ? null : row.name,
      message: row.text_hidden || !row.name ? null : row.message,
      people: null as number | null,
      wornOn: worn.get(row.id) ?? null,
    })),
  );
  return { sort, page, cards, more: rows.results.length === 20 };
}

async function handleAdmin(request: Request, env: Env) {
  await guardAdmin(request, env);
  if (request.method === "POST") {
    const form = await request.formData();
    if (form.get("intent") === "rerun_daily") {
      await runDaily(env, { force: true });
      return redirect("/admin?ran=1");
    }
    return redirect("/admin");
  }
  const { today } = publishCutoff(env);
  const [outfit, pending, run] = await Promise.all([
    env.DB.prepare("SELECT date FROM outfits WHERE date = ?").bind(today).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM suggestions WHERE status = 'pending'").first<{ n: number }>(),
    latestRun(env),
  ]);
  return {
    today,
    logged: !!outfit,
    pending: pending?.n ?? 0,
    run,
    ran: new URL(request.url).searchParams.get("ran") === "1",
  };
}

async function loadAdminItems(request: Request, env: Env) {
  await guardAdmin(request, env);
  const rows = await env.DB.prepare(
    "SELECT id, name, slot, archived_at FROM items ORDER BY archived_at IS NOT NULL, name",
  ).all<{ id: string; name: string; slot: string; archived_at: number | null }>();
  return { items: rows.results };
}

async function handleAdminItemNew(request: Request, env: Env) {
  await guardAdmin(request, env);
  if (request.method === "POST") {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return data({ error: "Missing item id.", id: crypto.randomUUID() }, { status: 400 });
    const parsed = parseItemForm(form);
    if (!parsed.success) {
      return data({ error: zodError(parsed.error), id, values: formValues(form) }, { status: 400 });
    }
    if (form.get("removePhoto") === "on") parsed.data.photo = undefined;
    await saveItem(getDb(env), id, parsed.data);
    return redirect(`/admin/items/${id}`);
  }
  return { id: crypto.randomUUID() };
}

async function handleAdminItem(request: Request, env: Env, params: Params) {
  const id = required(params, "id");
  await guardAdmin(request, env);
  const db = getDb(env);
  const current = (await db.select().from(items).where(eq(items.id, id)))[0];
  if (!current) throw data("Not found", { status: 404 });
  if (request.method !== "POST") return { item: current };
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");
  if (intent === "archive" || intent === "unarchive") {
    await setArchived(db, current.id, intent === "archive");
    return redirect(`/admin/items/${current.id}`);
  }
  if (intent === "delete") {
    const result = await deleteItem(db, current.id);
    if (!result.ok) return data({ error: result.error }, { status: 400 });
    await deleteImage(env, current.photoKey, current.photoExt);
    return redirect("/admin/items");
  }
  const parsed = parseItemForm(form);
  if (!parsed.success) return data({ error: zodError(parsed.error) }, { status: 400 });
  const input: ItemInput = { ...parsed.data };
  if (form.get("removePhoto") === "on") input.photo = undefined;
  else if (!input.photo && current.photoKey && current.photoExt && current.photoW && current.photoH) {
    input.photo = {
      key: current.photoKey,
      ext: current.photoExt as "webp" | "jpg",
      w: current.photoW,
      h: current.photoH,
    };
  }
  await saveItem(db, current.id, input, current.createdAt);
  if (current.photoKey && current.photoKey !== (input.photo?.key ?? null)) {
    await deleteImage(env, current.photoKey, current.photoExt);
  }
  return redirect(`/admin/items/${current.id}`);
}

async function handleAdminOutfit(request: Request, env: Env, params: Params) {
  const date = required(params, "date");
  if (!isoDate.safeParse(date).success) throw data("Not found", { status: 404 });
  await guardAdmin(request, env);
  if (request.method === "POST") return saveAdminOutfit(request, env, date);
  const { today } = publishCutoff(env);
  const outfit = await env.DB.prepare(
    "SELECT date, rating, note, fit_pic_key, fit_pic_ext, fit_pic_w, fit_pic_h, source_suggestion_id FROM outfits WHERE date = ?",
  )
    .bind(date)
    .first<{
      date: string;
      rating: number | null;
      note: string | null;
      fit_pic_key: string | null;
      fit_pic_ext: string | null;
      fit_pic_w: number | null;
      fit_pic_h: number | null;
      source_suggestion_id: string | null;
    }>();
  const chosen = await env.DB.prepare("SELECT item_id FROM outfit_items WHERE date = ?")
    .bind(date)
    .all<{ item_id: string }>();
  let selected = chosen.results.map((row) => row.item_id);
  let source = outfit?.source_suggestion_id ?? null;
  const from = new URL(request.url).searchParams.get("from_suggestion");
  if (!outfit && from) {
    const suggestion = await env.DB.prepare("SELECT status FROM suggestions WHERE id = ?")
      .bind(from)
      .first<{ status: string }>();
    if (suggestion?.status === "approved") {
      const pieces = await env.DB.prepare("SELECT item_id FROM suggestion_items WHERE suggestion_id = ?")
        .bind(from)
        .all<{ item_id: string }>();
      selected = pieces.results.map((row) => row.item_id);
      source = from;
    }
  }
  const catalog = await env.DB.prepare(
    "SELECT id, name, slot, archived_at FROM items ORDER BY name",
  ).all<{ id: string; name: string; slot: string; archived_at: number | null }>();
  const visible = catalog.results.filter((item) => item.archived_at == null || selected.includes(item.id));
  return { date, today, outfit, selected, source, items: visible };
}

async function saveAdminOutfit(request: Request, env: Env, date: string) {
  const form = await request.formData();
  const db = getDb(env);
  if (form.get("intent") === "delete") {
    const removed = await deleteOutfit(db, date);
    if (removed?.fitPicKey) await deleteImage(env, removed.fitPicKey, removed.fitPicExt);
    return redirect("/admin");
  }
  const parsed = parseOutfitForm(form, date);
  if (!parsed.success) return data({ error: zodError(parsed.error) }, { status: 400 });
  const existing = await env.DB.prepare(
    "SELECT fit_pic_key, fit_pic_ext, fit_pic_w, fit_pic_h, source_suggestion_id FROM outfits WHERE date = ?",
  )
    .bind(date)
    .first<{
      fit_pic_key: string | null;
      fit_pic_ext: string | null;
      fit_pic_w: number | null;
      fit_pic_h: number | null;
      source_suggestion_id: string | null;
    }>();
  const input: OutfitInput = { ...parsed.data };
  if (form.get("removeFitPic") === "on") input.fitPic = undefined;
  else if (!input.fitPic && existing?.fit_pic_key && existing.fit_pic_ext && existing.fit_pic_w && existing.fit_pic_h) {
    input.fitPic = {
      key: existing.fit_pic_key,
      ext: existing.fit_pic_ext as "webp" | "jpg",
      w: existing.fit_pic_w,
      h: existing.fit_pic_h,
    };
  }
  if (!input.sourceSuggestionId && existing?.source_suggestion_id) {
    input.sourceSuggestionId = existing.source_suggestion_id;
  }
  const { today } = publishCutoff(env);
  const saved = await saveOutfit(db, input, today);
  if (!saved.ok) return data({ error: saved.error }, { status: 400 });
  if (saved.previous?.key && saved.previous.key !== (input.fitPic?.key ?? null)) {
    await deleteImage(env, saved.previous.key, saved.previous.ext);
  }
  return redirect(`/admin/outfits/${date}`);
}

async function loadAdminSuggestions(request: Request, env: Env) {
  await guardAdmin(request, env);
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const allowed = status === "approved" || status === "rejected" ? status : "pending";
  const rows = await env.DB.prepare(
    `SELECT id, name, message, combo_key, created_at FROM suggestions
     WHERE status = ? ORDER BY created_at ${allowed === "pending" ? "ASC" : "DESC"} LIMIT 100`,
  )
    .bind(allowed)
    .all<{ id: string; name: string | null; message: string | null; combo_key: string; created_at: number }>();
  const counts = await env.DB.prepare(
    "SELECT combo_key, COUNT(*) AS n FROM suggestions WHERE status = 'approved' GROUP BY combo_key",
  ).all<{ combo_key: string; n: number }>();
  const countByCombo = new Map(counts.results.map((row) => [row.combo_key, row.n]));
  const ids = rows.results.map((row) => row.id);
  const pieces = ids.length
    ? await env.DB.prepare(
        `SELECT si.suggestion_id AS suggestion_id, i.id AS id, i.name AS name,
                i.photo_key AS photo_key, i.photo_ext AS photo_ext, i.photo_w, i.photo_h
         FROM suggestion_items si JOIN items i ON i.id = si.item_id
         WHERE si.suggestion_id IN (${ids.map(() => "?").join(",")})`,
      )
        .bind(...ids)
        .all<{
          suggestion_id: string;
          id: string;
          name: string;
          photo_key: string | null;
          photo_ext: string | null;
          photo_w: number | null;
          photo_h: number | null;
        }>()
    : { results: [] };
  const grouped = new Map<string, typeof pieces.results>();
  for (const piece of pieces.results) {
    const list = grouped.get(piece.suggestion_id) ?? [];
    list.push(piece);
    grouped.set(piece.suggestion_id, list);
  }
  const { today } = publishCutoff(env);
  return {
    status: allowed,
    today,
    suggestions: rows.results.map((row) => ({
      ...row,
      same: countByCombo.get(row.combo_key) ?? 0,
      pieces: grouped.get(row.id) ?? [],
    })),
  };
}

async function handleAdminSuggestion(request: Request, env: Env, params: Params) {
  await guardAdmin(request, env);
  if (request.method !== "POST") throw redirect("/admin/suggestions");
  const id = required(params, "id");
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const now = Date.now();
  if (intent === "approve" || intent === "approve_hide_text") {
    await env.DB.prepare(
      "UPDATE suggestions SET status = 'approved', text_hidden = ?, reviewed_at = ? WHERE id = ?",
    )
      .bind(intent === "approve_hide_text" ? 1 : 0, now, id)
      .run();
  } else if (intent === "reject") {
    await env.DB.prepare("UPDATE suggestions SET status = 'rejected', reviewed_at = ? WHERE id = ?")
      .bind(now, id)
      .run();
  } else if (intent === "block_ip") {
    const row = await env.DB.prepare("SELECT ip_hash FROM suggestions WHERE id = ?")
      .bind(id)
      .first<{ ip_hash: string }>();
    if (!row) throw data("Not found", { status: 404 });
    await env.DB.batch([
      env.DB.prepare("UPDATE suggestions SET status = 'rejected', reviewed_at = ? WHERE id = ?").bind(now, id),
      env.DB.prepare(
        "INSERT INTO blocked_ips (ip_hash, reason, created_at) VALUES (?, 'suggestion', ?) ON CONFLICT(ip_hash) DO NOTHING",
      ).bind(row.ip_hash, now),
    ]);
  }
  return redirect("/admin/suggestions");
}

async function loadAdminLogin(request: Request, env: Env) {
  if (await hasAdminSession(request, env)) throw redirect("/admin");
  return null;
}

async function handleLoginPasskey(request: Request, env: Env) {
  assertAdminOrigin(request, env);
  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { response?: AuthenticationResponseJSON };
    if (!body.response) return Response.json({ error: "Passkey was not accepted." }, { status: 400 });
    return finishLogin(request, env, body.response);
  }
  const form = await request.formData();
  if (form.get("intent") === "options") return beginLogin(env);
  return Response.json({ error: "Passkey was not accepted." }, { status: 400 });
}

async function loadAdminSetup(request: Request, env: Env) {
  const allowed = await registrationAllowed(request, env);
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  return { allowed, token };
}

async function handleSetupPasskey(request: Request, env: Env) {
  assertAdminOrigin(request, env);
  if (!(await registrationAllowed(request, env))) {
    return Response.json({ error: "This setup link is not valid." }, { status: 403 });
  }
  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { response?: RegistrationResponseJSON; label?: string };
    if (!body.response) return Response.json({ error: "Passkey was not accepted." }, { status: 400 });
    const label = body.label?.trim().slice(0, 80) || null;
    return finishRegistration(request, env, body.response, label);
  }
  const form = await request.formData();
  if (form.get("intent") === "options") return beginRegistration(env);
  return Response.json({ error: "Passkey was not accepted." }, { status: 400 });
}

async function handleLogout(request: Request, env: Env) {
  assertAdminOrigin(request, env);
  return logout(request, env);
}

async function handleUpload(request: Request, env: Env) {
  await guardAdmin(request, env);
  const form = await request.formData();
  const kind = form.get("kind");
  const owner = String(form.get("owner") ?? "");
  const w = Number(form.get("w"));
  const h = Number(form.get("h"));
  if (kind !== "item" && kind !== "fit") return Response.json({ error: "Unknown upload." }, { status: 400 });
  if (kind === "item" && !/^[0-9a-f-]{36}$/.test(owner)) return Response.json({ error: "Unknown item." }, { status: 400 });
  if (kind === "fit" && !/^\d{4}-\d{2}-\d{2}$/.test(owner)) return Response.json({ error: "Unknown date." }, { status: 400 });
  if (!Number.isInteger(w) || w <= 0 || !Number.isInteger(h) || h <= 0) {
    return Response.json({ error: "Missing dimensions." }, { status: 400 });
  }
  const small = form.get("small");
  const large = form.get("large");
  if (!(small instanceof File) || !(large instanceof File)) return Response.json({ error: "Choose a photo." }, { status: 400 });
  if (small.size > MAX_BYTES || large.size > MAX_BYTES) {
    return Response.json({ error: "Each photo must be under 1.5 MB." }, { status: 400 });
  }
  const smallBytes = new Uint8Array(await small.arrayBuffer());
  const largeBytes = new Uint8Array(await large.arrayBuffer());
  const ext = sniffImage(smallBytes);
  if (!ext || sniffImage(largeBytes) !== ext) {
    return Response.json({ error: "Photos have to be WebP or JPEG." }, { status: 400 });
  }
  const key = `${kind === "item" ? "items" : "fits"}/${owner}/${crypto.randomUUID()}`;
  const httpMetadata = { contentType: contentTypeFor(ext) };
  await env.MEDIA.put(`${key}-480.${ext}`, smallBytes, { httpMetadata });
  await env.MEDIA.put(`${key}-1600.${ext}`, largeBytes, { httpMetadata });
  return Response.json({ key, ext, w, h });
}

async function withPieces<T extends { id: string }>(env: Env, cards: T[]) {
  if (cards.length === 0) return [];
  const placeholders = cards.map(() => "?").join(",");
  const pieces = await env.DB.prepare(
    `SELECT si.suggestion_id AS suggestion_id, i.id AS id, i.name AS name,
            i.photo_key AS photo_key, i.photo_ext AS photo_ext, i.photo_w AS photo_w, i.photo_h AS photo_h
     FROM suggestion_items si JOIN items i ON i.id = si.item_id
     WHERE si.suggestion_id IN (${placeholders})`,
  )
    .bind(...cards.map((card) => card.id))
    .all<{
      suggestion_id: string;
      id: string;
      name: string;
      photo_key: string | null;
      photo_ext: string | null;
      photo_w: number | null;
      photo_h: number | null;
    }>();
  const grouped = new Map<
    string,
    { id: string; name: string; photoKey: string | null; photoExt: "webp" | "jpg" | null; photoW: number | null; photoH: number | null }[]
  >();
  for (const piece of pieces.results) {
    const list = grouped.get(piece.suggestion_id) ?? [];
    list.push({
      id: piece.id,
      name: piece.name,
      photoKey: piece.photo_key,
      photoExt: photoExt(piece.photo_ext),
      photoW: piece.photo_w,
      photoH: piece.photo_h,
    });
    grouped.set(piece.suggestion_id, list);
  }
  return cards.map((card) => ({ ...card, pieces: grouped.get(card.id) ?? [] }));
}

function compareItems(a: ItemCard, b: ItemCard, sort: string): number {
  if (sort === "wears") return b.wearCount - a.wearCount || a.name.localeCompare(b.name);
  if (sort === "last_worn") {
    if (a.lastWorn === b.lastWorn) return a.name.localeCompare(b.name);
    if (!a.lastWorn) return 1;
    if (!b.lastWorn) return -1;
    return a.lastWorn < b.lastWorn ? 1 : -1;
  }
  if (sort === "acquired") {
    if (a.acquiredOn === b.acquiredOn) return a.name.localeCompare(b.name);
    if (!a.acquiredOn) return 1;
    if (!b.acquiredOn) return -1;
    return a.acquiredOn < b.acquiredOn ? 1 : -1;
  }
  return a.name.localeCompare(b.name);
}

function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

function photoExt(ext: string | null): "webp" | "jpg" | null {
  return ext === "webp" || ext === "jpg" ? ext : null;
}

function required(params: Params, key: string): string {
  const value = params[key];
  if (!value) throw data("Not found", { status: 404 });
  return value;
}
