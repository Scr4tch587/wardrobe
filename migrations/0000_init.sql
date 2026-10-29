CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slot` text NOT NULL,
	`color` text,
	`brand` text,
	`acquired_on` text,
	`anecdote` text,
	`photo_key` text,
	`photo_ext` text,
	`photo_w` integer,
	`photo_h` integer,
	`temp_min_c` real,
	`temp_max_c` real,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "items_name_len" CHECK(length(name) BETWEEN 1 AND 80),
	CONSTRAINT "items_slot" CHECK(slot IN ('top','bottom','outerwear','shoes','accessory')),
	CONSTRAINT "items_color_len" CHECK(color IS NULL OR length(color) <= 40),
	CONSTRAINT "items_brand_len" CHECK(brand IS NULL OR length(brand) <= 60),
	CONSTRAINT "items_acquired_on" CHECK(acquired_on IS NULL OR acquired_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "items_anecdote_len" CHECK(anecdote IS NULL OR length(anecdote) <= 4000),
	CONSTRAINT "items_photo_ext" CHECK(photo_ext IS NULL OR photo_ext IN ('webp','jpg')),
	CONSTRAINT "items_photo_pair" CHECK((photo_key IS NULL) = (photo_ext IS NULL)),
	CONSTRAINT "items_temp_range" CHECK(temp_min_c IS NULL OR temp_max_c IS NULL OR temp_min_c < temp_max_c)
);
--> statement-breakpoint
CREATE INDEX `items_active_slot` ON `items` (`slot`) WHERE archived_at IS NULL;
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`combo_key` text NOT NULL,
	`name` text,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`text_hidden` integer DEFAULT 0 NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	CONSTRAINT "suggestions_name_len" CHECK(name IS NULL OR length(name) BETWEEN 1 AND 40),
	CONSTRAINT "suggestions_message_len" CHECK(message IS NULL OR length(message) BETWEEN 1 AND 280),
	CONSTRAINT "suggestions_status" CHECK(status IN ('pending','approved','rejected')),
	CONSTRAINT "suggestions_text_hidden" CHECK(text_hidden IN (0,1)),
	CONSTRAINT "suggestions_review" CHECK((status = 'pending') = (reviewed_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX `suggestions_queue` ON `suggestions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `suggestions_approved_combo` ON `suggestions` (`combo_key`) WHERE status = 'approved';
--> statement-breakpoint
CREATE INDEX `suggestions_by_ip` ON `suggestions` (`ip_hash`,`created_at`);
--> statement-breakpoint
CREATE TABLE `suggestion_items` (
	`suggestion_id` text NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`suggestion_id`, `item_id`),
	FOREIGN KEY (`suggestion_id`) REFERENCES `suggestions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE restrict
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `suggestion_items_by_item` ON `suggestion_items` (`item_id`);
--> statement-breakpoint
CREATE TABLE `outfits` (
	`date` text PRIMARY KEY NOT NULL,
	`rating` integer,
	`note` text,
	`fit_pic_key` text,
	`fit_pic_ext` text,
	`fit_pic_w` integer,
	`fit_pic_h` integer,
	`source_suggestion_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_suggestion_id`) REFERENCES `suggestions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "outfits_date" CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "outfits_rating" CHECK(rating IS NULL OR rating BETWEEN 1 AND 10),
	CONSTRAINT "outfits_note_len" CHECK(note IS NULL OR length(note) <= 2000),
	CONSTRAINT "outfits_fit_ext" CHECK(fit_pic_ext IS NULL OR fit_pic_ext IN ('webp','jpg')),
	CONSTRAINT "outfits_fit_pair" CHECK((fit_pic_key IS NULL) = (fit_pic_ext IS NULL))
);
--> statement-breakpoint
CREATE INDEX `outfits_source_suggestion` ON `outfits` (`source_suggestion_id`) WHERE source_suggestion_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `outfit_items` (
	`date` text NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`date`, `item_id`),
	FOREIGN KEY (`date`) REFERENCES `outfits`(`date`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE restrict
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `outfit_items_by_item` ON `outfit_items` (`item_id`,`date`);
--> statement-breakpoint
CREATE TABLE `weather` (
	`date` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`temp_max_c` real NOT NULL,
	`temp_min_c` real NOT NULL,
	`apparent_max_c` real NOT NULL,
	`apparent_min_c` real NOT NULL,
	`precip_mm` real,
	`weather_code` integer,
	`fetched_at` integer NOT NULL,
	CONSTRAINT "weather_kind" CHECK(kind IN ('forecast','actual'))
);
--> statement-breakpoint
CREATE TABLE `ranking_runs` (
	`date` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`effective_temp` real,
	`params_json` text NOT NULL,
	`computed_at` integer NOT NULL,
	CONSTRAINT "ranking_runs_status" CHECK(status IN ('ok','degraded'))
);
--> statement-breakpoint
CREATE TABLE `rankings` (
	`date` text NOT NULL,
	`item_id` text NOT NULL,
	`rank` integer NOT NULL,
	`score` real NOT NULL,
	`season_fit` real NOT NULL,
	`recency` real NOT NULL,
	`enjoyment` real NOT NULL,
	`underuse` real NOT NULL,
	PRIMARY KEY(`date`, `item_id`),
	FOREIGN KEY (`date`) REFERENCES `ranking_runs`(`date`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rankings_rank" CHECK(rank >= 1)
) WITHOUT ROWID;
--> statement-breakpoint
CREATE UNIQUE INDEX `rankings_date_rank` ON `rankings` (`date`,`rank`);
--> statement-breakpoint
CREATE TABLE `blocked_ips` (
	`ip_hash` text PRIMARY KEY NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_credentials` (
	`credential_id` text PRIMARY KEY NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`label` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);
