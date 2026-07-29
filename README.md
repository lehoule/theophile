# Théophile

Astro/TypeScript static publishing platform and Cloudflare Worker/D1 comment API for [theophile.blog](https://www.theophile.blog/).

## Copyright and license

This repository is proprietary and all rights are reserved. The articles and
other original creative content may be read and linked to, but may not be
copied, scraped, mirrored, republished, translated, adapted, sold, or used for
AI/ML training without prior written permission. Short quotations are allowed
only where applicable law permits them and must include clear attribution and
a link to the original. See [LICENSE](LICENSE) for the complete terms.

Third-party works and dependencies remain subject to their own licenses.

## Local setup

Install Node.js 22 and dependencies:

```sh
npm install
npm run dev
```

Before committing, format the source and run the checks:

```sh
npm run format
npm run lint
npm test
```

`npm run build` runs the formatting check and lint/type diagnostics before
building the static site.

The command above starts only Astro’s frontend server. To exercise the full local site, including the Worker API and local D1 database:

```sh
cp .env.example .env
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev:worker
```

Open `http://localhost:8787`. `dev:worker` builds the static site first, then starts Wrangler with the local D1 binding. The test Turnstile keys in `.env.example` and `.dev.vars.example` are for development only; replace them with real values for a deployed environment. The admin API is protected by Cloudflare Access in production and is not an end-to-end local Access environment.

For local media-upload and comment-moderation testing, `.dev.vars` may set
`LOCAL_ADMIN_AUTH=true`. This bypass is accepted only for requests to
localhost, `127.0.0.1`, or `::1`; production hosts still require Cloudflare
Access. Local comment submissions also skip Turnstile in this mode; rate
limits and all other comment validation remain active.

Create an article locally:

```sh
node scripts/create-post.mjs "Mon nouveau titre"
```

See [WRITING.md](WRITING.md) for the writer’s guide, including Markdown, references and the publishing checklist.

Set `draft: false` only when an article is ready to publish. Because the repository is public, do not push private drafts.

To load local content from WordPress, keep the WXR export outside the repository and run:

```sh
node scripts/import-wordpress.mjs /secure/path/wordpress.xml
node scripts/import-wordpress-comments.mjs /secure/path/wordpress.xml
npm run check
npm run build
npm run db:import:local
```

The first importer creates Markdown in `src/content/posts` and `src/content/pages`. The second creates the idempotent SQL file `backups/comment-import.sql`; it intentionally contains no manual transaction wrapper because `wrangler d1 execute --file` manages the import transaction. The local import command applies it to D1. Run `npm run registry` whenever you need to inspect or regenerate the commentable-post registry.

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

The inventory only includes files under WordPress's `YYYY/MM` upload paths;
plugin-generated directories such as `wpconsent` are excluded.

Preview the R2 migration first. This verifies every source file exists and its
SHA-256 checksum matches the manifest without uploading anything:

```sh
npm run media:upload -- /secure/path/wp-content/uploads --dry-run
```

After reviewing the dry-run output, authenticate Wrangler with the Cloudflare
account that owns the bucket and upload the originals:

```sh
npx wrangler login
npm run media:upload -- /secure/path/wp-content/uploads
```

The uploader preserves each `YYYY/MM/...` key, sets the recorded MIME type,
and uploads to the `theophile-media` bucket. It uses the manifest checksum to
avoid uploading a file from the wrong WordPress export. After each successful
upload it atomically records the key and checksum in
`.media-upload-state.json`, so a later run skips completed files after a
failure. Use `--state=/path/to/state.json` when you want the state file in a
different location. The migration media directory stays outside this
repository.

## Cloudflare setup

1. Create a production D1 database named `theophile-comments` and replace `database_id` in `wrangler.toml`.
2. Create R2 buckets named `theophile-media` and `theophile-private`; attach the media bucket to `media.theophile.blog` and do not make the private bucket public.
3. Apply migrations locally first, then remotely:

   ```sh
   npm run db:migrate:local
   npm run db:migrate:remote
   ```

4. Create secrets:

   ```sh
   npx wrangler secret put TURNSTILE_SECRET
   npx wrangler secret put ADMIN_EMAIL
   ```

5. Configure a Turnstile widget for `www.theophile.blog` and set `PUBLIC_TURNSTILE_SITE_KEY` in the Cloudflare build environment before production.
6. Set the `ADMIN_EMAIL` GitHub Actions secret to the same email allowed by
   the Access policy. The deployment workflow provisions it as a Worker secret.
   Email notifications are currently disabled.
7. Protect `/admin/comments/*`, `/admin/media/*`, and `/api/admin/*` with a Cloudflare Access application restricted to the owner’s email. Access must add both the authenticated email and JWT headers.
8. Deploy with `npm run deploy`, attach `www.theophile.blog` as the Worker custom domain, and configure the apex domain to redirect to `www`.

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
- `POST /api/admin/media`

The media upload page is available at `/admin/media/`. Protect both
`/admin/comments/*` and `/admin/media/*` with the Cloudflare Access application
used for administration. The page sends files to the Worker, which validates
the type and size before streaming them into the `theophile-media` R2 bucket;
R2 credentials are never exposed to the browser.

The public API never returns email addresses, IP hashes, or moderation metadata. All new comments are pending until approved.
