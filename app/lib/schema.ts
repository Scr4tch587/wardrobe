import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slot: text("slot").notNull(),
    color: text("color"),
    brand: text("brand"),
    acquiredOn: text("acquired_on"),
    anecdote: text("anecdote"),
    photoKey: text("photo_key"),
    photoExt: text("photo_ext"),
    photoW: integer("photo_w"),
    photoH: integer("photo_h"),
    tempMinC: real("temp_min_c"),
    tempMaxC: real("temp_max_c"),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("items_active_slot").on(table.slot).where(sql`archived_at IS NULL`),
    check("items_name_len", sql`length(name) BETWEEN 1 AND 80`),
    check(
      "items_slot",
      sql`slot IN ('top','bottom','outerwear','shoes','accessory')`,
    ),
    check("items_color_len", sql`color IS NULL OR length(color) <= 40`),
    check("items_brand_len", sql`brand IS NULL OR length(brand) <= 60`),
    check(
      "items_acquired_on",
      sql`acquired_on IS NULL OR acquired_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check("items_anecdote_len", sql`anecdote IS NULL OR length(anecdote) <= 4000`),
    check("items_photo_ext", sql`photo_ext IS NULL OR photo_ext IN ('webp','jpg')`),
    check("items_photo_pair", sql`(photo_key IS NULL) = (photo_ext IS NULL)`),
    check(
      "items_temp_range",
      sql`temp_min_c IS NULL OR temp_max_c IS NULL OR temp_min_c < temp_max_c`,
    ),
  ],
);

export const suggestions = sqliteTable(
  "suggestions",
  {
    id: text("id").primaryKey(),
    comboKey: text("combo_key").notNull(),
    name: text("name"),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    textHidden: integer("text_hidden").notNull().default(0),
    ipHash: text("ip_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    reviewedAt: integer("reviewed_at"),
  },
  () => [
    index("suggestions_queue").on(sql`status`, sql`created_at`),
    index("suggestions_approved_combo")
      .on(sql`combo_key`)
      .where(sql`status = 'approved'`),
    index("suggestions_by_ip").on(sql`ip_hash`, sql`created_at`),
    check(
      "suggestions_name_len",
      sql`name IS NULL OR length(name) BETWEEN 1 AND 40`,
    ),
    check(
      "suggestions_message_len",
      sql`message IS NULL OR length(message) BETWEEN 1 AND 280`,
    ),
    check(
      "suggestions_status",
      sql`status IN ('pending','approved','rejected')`,
    ),
    check("suggestions_text_hidden", sql`text_hidden IN (0,1)`),
    check(
      "suggestions_review",
      sql`(status = 'pending') = (reviewed_at IS NULL)`,
    ),
  ],
);

export const suggestionItems = sqliteTable(
  "suggestion_items",
  {
    suggestionId: text("suggestion_id")
      .notNull()
      .references(() => suggestions.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.suggestionId, table.itemId] }),
    index("suggestion_items_by_item").on(table.itemId),
  ],
);

export const outfits = sqliteTable(
  "outfits",
  {
    date: text("date").primaryKey(),
    rating: integer("rating"),
    note: text("note"),
    fitPicKey: text("fit_pic_key"),
    fitPicExt: text("fit_pic_ext"),
    fitPicW: integer("fit_pic_w"),
    fitPicH: integer("fit_pic_h"),
    sourceSuggestionId: text("source_suggestion_id").references(
      () => suggestions.id,
      { onDelete: "set null" },
    ),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  () => [
    index("outfits_source_suggestion")
      .on(sql`source_suggestion_id`)
      .where(sql`source_suggestion_id IS NOT NULL`),
    check(
      "outfits_date",
      sql`date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check("outfits_rating", sql`rating IS NULL OR rating BETWEEN 1 AND 10`),
    check("outfits_note_len", sql`note IS NULL OR length(note) <= 2000`),
    check(
      "outfits_fit_ext",
      sql`fit_pic_ext IS NULL OR fit_pic_ext IN ('webp','jpg')`,
    ),
    check("outfits_fit_pair", sql`(fit_pic_key IS NULL) = (fit_pic_ext IS NULL)`),
  ],
);

export const outfitItems = sqliteTable(
  "outfit_items",
  {
    date: text("date")
      .notNull()
      .references(() => outfits.date, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.itemId] }),
    index("outfit_items_by_item").on(table.itemId, table.date),
  ],
);

export const weather = sqliteTable(
  "weather",
  {
    date: text("date").primaryKey(),
    kind: text("kind").notNull(),
    tempMaxC: real("temp_max_c").notNull(),
    tempMinC: real("temp_min_c").notNull(),
    apparentMaxC: real("apparent_max_c").notNull(),
    apparentMinC: real("apparent_min_c").notNull(),
    precipMm: real("precip_mm"),
    weatherCode: integer("weather_code"),
    fetchedAt: integer("fetched_at").notNull(),
  },
  () => [check("weather_kind", sql`kind IN ('forecast','actual')`)],
);

export const rankingRuns = sqliteTable(
  "ranking_runs",
  {
    date: text("date").primaryKey(),
    status: text("status").notNull(),
    effectiveTemp: real("effective_temp"),
    paramsJson: text("params_json").notNull(),
    computedAt: integer("computed_at").notNull(),
  },
  () => [check("ranking_runs_status", sql`status IN ('ok','degraded')`)],
);

export const rankings = sqliteTable(
  "rankings",
  {
    date: text("date")
      .notNull()
      .references(() => rankingRuns.date, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    score: real("score").notNull(),
    seasonFit: real("season_fit").notNull(),
    recency: real("recency").notNull(),
    enjoyment: real("enjoyment").notNull(),
    underuse: real("underuse").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.itemId] }),
    uniqueIndex("rankings_date_rank").on(table.date, table.rank),
    check("rankings_rank", sql`rank >= 1`),
  ],
);

export const blockedIps = sqliteTable("blocked_ips", {
  ipHash: text("ip_hash").primaryKey(),
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
});

export const adminCredentials = sqliteTable("admin_credentials", {
  credentialId: text("credential_id").primaryKey(),
  publicKey: blob("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  label: text("label"),
  createdAt: integer("created_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("sessions_expiry").on(table.expiresAt)],
);
