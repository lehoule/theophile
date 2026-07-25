# Théophile

Astro/TypeScript static publishing platform and Cloudflare Worker/D1 comment API for [theophile.xyz](https://www.theophile.xyz/).

## Local setup

Install Node.js 22 and dependencies:

```sh
npm install
npm run dev
```

The command above starts only Astro’s frontend server. To exercise the full local site, including the Worker API and local D1 database:

```sh
cp .env.example .env
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev:worker
```

Open `http://localhost:8787`. `dev:worker` builds the static site first, then starts Wrangler with the local D1 binding. The test Turnstile keys in `.env.example` and `.dev.vars.example` are for development only; replace them with real values for a deployed environment. The admin API is protected by Cloudflare Access in production and is not an end-to-end local Access environment.

Create an article locally:

```sh
node scripts/create-post.mjs "Mon nouveau titre"
```

Set `draft: false` only when an article is ready to publish. Because the repository is public, do not push private drafts.

To load local content from WordPress, keep the WXR export outside the repository and run:

```sh
node scripts/import-wordpress.mjs /secure/path/wordpress.xml
node scripts/import-wordpress-comments.mjs /secure/path/wordpress.xml
npm run check
npm run build
npm run db:import:local
```

The first importer creates Markdown in `src/content/posts` and `src/content/pages`. The second creates the idempotent SQL file `backups/comment-import.sql`; the local import command applies it to D1. Run `npm run registry` whenever you need to inspect or regenerate the commentable-post registry.

## WordPress migration

From WordPress, export **Tools → Export → All Content** and save the WXR file outside the public repository. Then run:

```sh
node scripts/import-wordpress.mjs /secure/path/wordpress.xml
node scripts/import-wordpress-comments.mjs /secure/path/wordpress.xml
npm run check
npm run build
```

Review `migration/content-report.json`, every conversion warning, and `backups/comment-import.sql` before applying the SQL to D1. The importer intentionally does not delete existing content.

After the content and post registry have been reviewed, apply the idempotent comment import:

```sh
npx wrangler d1 execute theophile-comments --remote --file=backups/comment-import.sql
```

Media should be copied from the WHC `wp-content/uploads` directory into R2. Do not commit the media library to Git; the current library contains substantial audio and image data.

Generate the typed inventory before uploading originals (generated WordPress size variants are skipped):

```sh
node scripts/inventory-media.mjs /secure/path/wp-content/uploads
```

## Cloudflare setup

1. Create a production D1 database named `theophile-comments` and replace `database_id` in `wrangler.toml`.
2. Create R2 buckets named `theophile-media` and `theophile-private`; attach the media bucket to `media.theophile.xyz` and do not make the private bucket public.
3. Apply migrations locally first, then remotely:

   ```sh
   npm run db:migrate:local
   npm run db:migrate:remote
   ```

4. Create secrets:

   ```sh
   npx wrangler secret put TURNSTILE_SECRET
   npx wrangler secret put RATE_LIMIT_SECRET
   ```

5. Configure a Turnstile widget for `www.theophile.xyz` and set `PUBLIC_TURNSTILE_SITE_KEY` in the Cloudflare build environment before production.
6. Configure a verified Cloudflare Email Service destination and set `ADMIN_EMAIL` in `wrangler.toml`. Set `PUBLIC_CF_ANALYTICS_TOKEN` in the build environment to enable cookie-free Web Analytics.
7. Protect `/admin/comments/*` and `/api/admin/*` with a Cloudflare Access application restricted to the owner’s email. Access must add both the authenticated email and JWT headers.
   Set `ACCESS_AUDIENCE` to the Access application audience tag when you want the Worker to enforce the JWT audience as well.
8. Deploy with `npm run deploy`, attach `www.theophile.xyz` as the Worker custom domain, and configure the apex domain to redirect to `www`.

The local/public Turnstile site key is supplied as the build variable `PUBLIC_TURNSTILE_SITE_KEY`; the secret key is stored only with `wrangler secret put TURNSTILE_SECRET`.

## API

Public:

- `GET /api/comments?postId=&cursor=`
- `GET /api/comments/counts?postIds=`
- `POST /api/comments`

Access-protected:

- `GET /api/admin/comments?status=&cursor=`
- `PATCH /api/admin/comments/:id`
- `POST /api/admin/comments/:id/replies`
- `DELETE /api/admin/comments/:id`

The public API never returns email addresses, IP hashes, or moderation metadata. All new comments are pending until approved.
