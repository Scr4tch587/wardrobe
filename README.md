# Wardrobe

A single-owner wardrobe. The owner logs one outfit a day. Everyone else can browse pieces, outfits, stats, the daily "should wear" list, and leave outfit suggestions.

The site runs on Vercel. The data plane runs on Cloudflare, next to the database and the photos.

| | Vercel | Cloudflare |
| --- | --- | --- |
| What it does | React Router pages, forms, admin, session cookies, preview deploys, cached HTML | D1, R2 photos, the daily cron, the suggestion rate limit, Turnstile checks, passkey verification |
| What the browser talks to | The site | Photo URLs only |

Each page asks the Worker for one payload. The Worker runs the queries and returns JSON. Photos are served from the Worker so they can sit in the edge cache.

## Local

```sh
npm install
npm run dev
```

That starts the Worker on http://localhost:8787 and the site on http://localhost:5173. The dev script creates `.env` and `.dev.vars`, and applies the local D1 migration.

Register the local passkey at http://localhost:5173/admin/setup?token=local-setup-token. The local Turnstile widget is Cloudflare's always-pass test key.

## Both platforms, with one browser login each

Wrangler is the Cloudflare CLI. The Vercel CLI is invoked with `npx`. The script opens a browser when a login is missing. After you approve both, it creates the database, the photo bucket, the secrets, the Turnstile widget, deploys the Worker, points the Vercel project at that Worker, and deploys the site.

```sh
npm install
npm run setup -- --domain your-app.vercel.app
```

`--domain` is the hostname people visit on Vercel. The script stores that as the passkey origin. It does not attach that hostname to the Worker. Photos stay on `workers.dev`.

The production setup token is printed once and written to `.setup-token` (gitignored). Register the live passkey at:

```text
https://your-app.vercel.app/admin/setup?token=THE_TOKEN
```

A passkey registered on localhost does not work on the live domain. Register one in each place.

Weather defaults to Waterloo, Ontario (`43.4643`, `-80.5204`). Change `SITE_LAT` and `SITE_LON` in `wrangler.jsonc` if that is wrong, then run `npm run deploy:api`.

## Commands

```sh
npm run dev          # Worker on :8787 and the site on :5173
npm test             # vitest in the Workers runtime
npm run typecheck
npm run deploy:api   # wrangler deploy
npm run deploy:web   # build the site and vercel deploy --prebuilt --prod
npm run deploy       # both
npm run db:migrate   # apply D1 migrations remotely
```
