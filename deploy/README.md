# Self-hosted deployment

This branch uses Next.js standalone output rather than Cloudflare/Sites. Build with `npm run build:selfhost`, copy `public` and `.next/static` into `.next/standalone`, and upload that standalone directory. Before switching releases, create `.next/cache` and give it the service user ownership: the systemd writable-path sandbox requires that directory to exist. Use the supplied systemd and Nginx templates. Use Node.js >=22.13 consistently for installation, build, tests and runtime.

## Authentication

Before starting the service:

1. Install Node.js, Nginx, a certificate manager and `htpasswd` on the target host. Create the `knowledge-garden` service user/group and `/var/lib/knowledge-garden`, owned by that user with mode 700.
2. Create `/etc/knowledge-garden/runtime.env` with the values below and a new random proxy secret (for example, generate locally with `openssl rand -hex 32`). Keep it root-owned with mode 600.
3. Build with `npm ci && npm run build:selfhost`. Copy `public` to `.next/standalone/public` and `.next/static` to `.next/standalone/.next/static`. Place the standalone contents in a release directory, create its `.next/cache` with service-user ownership, and point `/srv/knowledge-garden/current` at that release.
4. Install `knowledge-garden.service` in `/etc/systemd/system/`, run `systemctl daemon-reload`, then `systemctl enable --now knowledge-garden`.
5. Create `/etc/nginx/knowledge-garden.htpasswd` using `htpasswd -c` for the first username only (omit `-c` when adding later users). Restrict access to root and Nginx's worker group.
6. Create root-only `/etc/nginx/knowledge-garden-proxy.conf` containing `proxy_set_header x-knowledge-proxy-secret "YOUR_RANDOM_SECRET";` with exactly the same secret as the service environment.
7. Replace `DOMAIN` in the Nginx template with your domain. Obtain its certificate before enabling the HTTPS block; bootstrap with an HTTP-only ACME configuration if needed. For PDF generation, change `proxy_read_timeout 90s` to `proxy_read_timeout 210s`. Install/enable the configuration, run `nginx -t`, then reload Nginx.
8. Perform the health, authentication, persistence and revision-conflict checks described below. Configure certificate renewal with Nginx reload for your certificate manager.

Nginx HTTPS Basic Auth protects every route and supplies the authenticated username. Nginx must overwrite `x-knowledge-user` and `x-knowledge-proxy-secret`; the latter must match `KNOWLEDGE_PROXY_SECRET` in the service environment. Node binds only to loopback. Do not expose the application port or trust client-provided identity headers. The generated login instructions are stored outside the source repository, with owner-only permissions.

## Environment

Root-owned `/etc/knowledge-garden/runtime.env`, mode 600:

- `NODE_ENV=production`
- `HOSTNAME=127.0.0.1`
- `PORT=4187`
- `KNOWLEDGE_DATA_DIR=/var/lib/knowledge-garden`
- `KNOWLEDGE_ORIGIN=https://<your-domain>`
- `KNOWLEDGE_PROXY_SECRET=<random private proxy secret>`
- Optional `OPENAI_API_KEY`, `OPENAI_MODEL`.

No model key is included. Restart only `knowledge-garden.service` after configuring it. AI uses the existing OpenAI Responses API implementation.

## Persistence and rollback

Run exactly one application process per data directory. Writes use serialized revision comparison, fsync and atomic rename. The previous successfully saved JSON is copied to `.previous` before each replacement. Data stays outside release directories and survives restarts and release switches. Create additional offline backups for longer retention; the previous file is only a one-write recovery point.

Releases live under `/srv/knowledge-garden/releases/<release>`; `current` selects the active version. Before a future update, record `readlink /srv/knowledge-garden/current`, copy the service/config files to a timestamped backup and take a data snapshot. Roll back the symlink and restart this service. First-install rollback: stop and disable this service, unlink only its Nginx enabled-site symlink, run `nginx -t`, and reload Nginx. Preserve data, certificates and release artifacts for recovery.

Verify `systemctl is-active knowledge-garden`, loopback `/api/health`, public HTTPS 401 when anonymous, authenticated API read/write and stale revision rejection, then restart and reread the same data. Nginx's existing certbot renewal timer maintains the independent certificate. Ensure a successful renewal triggers `systemctl reload nginx`.

Existing Sites data is not automatically copied. Export JSON there if it contains real cards before planning an import. Initial self-hosted state is empty.

## AI settings in the website

Authenticated users can save their API Key and model in Settings → OpenAI. `/api/settings/ai` returns only configuration status and model, never the Key. A blank Key preserves the stored value; a supplied Key replaces it. Each AI request resolves settings afresh, so changes need no restart. If no website Key/model exists, the environment values remain the fallback.

Settings live in `KNOWLEDGE_DATA_DIR/ai-settings/`, isolated by authenticated username and excluded from knowledge JSON exports. Files are written atomically with mode 600, using AES-256-GCM encryption and owner-bound additional authenticated data. The encryption key is derived from `KNOWLEDGE_PROXY_SECRET` with a purpose-specific prefix. Back up that server secret together with encrypted settings through a private backup process; changing it without migration makes existing settings unreadable. A malformed or undecryptable file fails closed rather than silently using a different Key.

Saving does not make a paid API call or prove model entitlement. Both screenshot cards and association discovery use the saved model; it must support image input and structured outputs. No new external package or OpenAI API behavior was introduced in this change.

## FSRS scheduling (2026-10-31)

Scheduler is pinned to `ts-fsrs@5.4.2` (FSRS-6, Node >=20). v6 of the package requires Node >=24 and is intentionally not mixed into this Node 20 deployment. API signatures were checked via Context7 and the installed v5.4.2 type definitions/README. `lib/fsrs.ts` owns configuration, JSON conversion, preview and review. Profile `fsrs6-5.4.2-default-r90-v1`: retention 0.9, max 36500 days, no fuzz, short-term enabled, learning steps 1m/10m and relearning 10m. Retention is a scheduling target, not a guarantee. Personal parameter optimization is described below.

Migration is lazy and deliberately does not infer nonexistent ratings: existing due dates, cumulative review count, content and tree are unchanged until actual grading. On the first FSRS review, memory starts from New. For previously studied cards, the original SM-2 summary is retained under `fsrs.legacy` with strategy `cold-start`. Intervals may initially be shorter. Every subsequent grade saves the FSRS memory plus a numeric-timestamp review log, rating, profile ID and resulting due date. Logs are included in normal knowledge export; preview creates no stored log. The existing 4 MB state-write capacity remains in effect and errors rather than truncating data. A separate log store remains future work if capacity needs grow.

New writers now send `schedulerVersion:3`; the API rejects old pages lacking it with a refresh instruction, preventing old schema stripping of FSRS fields. Data and logs share the existing atomic revision-checked write. Keep the pre-upgrade backup. Before any live FSRS write, the previous release can be restored normally. After FSRS writes exist, do not roll back to an SM-2 release that drops unknown fields: preserve a fresh snapshot and prefer a forward fix or an explicitly planned compatible data migration. Do not restore an old snapshot over newer study records.

## Personal FSRS optimization (2026-10-31)

Desktop Settings → FSRS shows real log count, eligible cross-day samples, contributing cards, readiness reasons and the latest result. Training is manual. Product eligibility policy: 500 cross-day samples across 20 cards; chronological split needs 400 training / 100 validation samples, each with at least five forgotten and five remembered outcomes, plus repeated long-term reviews. This is not a library-imposed universal threshold. Same-day history is retained in prefixes; invalid/partial histories are excluded. UTC day differences match ts-fsrs. Use the most recent 5000 samples and complete sequences up to 200 reviews.

Pinned official native optimizer `@open-spaced-repetition/binding@0.5.0` supports the existing Node 20 / FSRS-6 runtime; do not upgrade to FSRS-7/Node-24-only packages independently. Context7 and installed declarations verified binding methods and camelCase `logLoss` / `rmseBins`. Train five epochs on the earlier 80%; evaluate the candidate, current and default parameters on the same later holdout. Adopt only if log loss beats both baselines by >0.0001 and RMSE does not exceed either baseline by >0.02. No full-data retrain is claimed. Holdout improvements do not guarantee future performance.

The native child runs with one thread, a 60-second kill timeout and one global job. Interrupted jobs recover to failed after 75 seconds. Failure or no improvement retains the current parameters. Optimization state is server-owned in the atomic revision store; client saves cannot overwrite it. Applying/resetting preserves existing due dates and logs, replaying real history under the selected parameters on the next grade. Profile archives remain available. Stale tabs must refresh after settings writes. After personal profiles are used, prefer a forward fix: older releases may reject profile IDs or strip state. Never restore a snapshot over newer study records.

For cross-platform deployment, build standalone and verify `scripts/fsrs-optimize-worker.cjs`, `node_modules/ts-fsrs`, and the binding packages are included. When building on macOS for Linux x64 glibc, run `npm pack @open-spaced-repetition/binding-linux-x64-gnu@0.5.0`, extract it with `--strip-components=1` into standalone `node_modules/@open-spaced-repetition/binding-linux-x64-gnu`, then smoke-test the worker on the target before switching the release. The smoke fixture is synthetic and must never be imported into production.

## Card learning notes

Optional `Card.notes` stores up to 12000 characters separately from the answer. Details, desktop study and mobile study share an explicit-save editor; new/edit card forms also support notes. Notes are included in JSON exports and are not included in AI association requests. Notes writes do not grade or alter scheduling. Unsaved inline drafts stay keyed by card during in-page navigation, warn before leaving the page, and block grading that card until saved/cancelled. Drafts are not durable until Save is clicked.

Missing notes from old clients preserve the stored value; an explicit empty string clears it. Existing optimistic revision checks still reject concurrent stale writes. No dependency or third-party API changes. After users save notes, prefer forward fixes over reverting to a release whose schema strips the new field.

### Comment-style notes supersede the single-note editor

Existing `notes` remains read-only as “原有备注”; new `comments` entries carry stable IDs, text and creation timestamps. The shared composer automatically upserts its current entry after 900 ms idle. Continued typing updates that same entry; “新增一条备注” starts another after acknowledgement. A reload starts a new composer and lists previously saved entries. Blank text never deletes an existing entry. No manual Save button. Study notes still appear only with the answer.

Drafts live in the page parent so hiding the answer or changing views does not cancel pending saves. Pending writes block grading, and page exit warns about unsaved text. Failed writes retain input with explicit retry; retry rereads state/revision before resubmission. Drafts are not durable offline until server acknowledgement. Existing revision checks and stable IDs prevent duplicate entries on retry. Ordinary older-client writes cannot omit existing comments; knowledge exports include them. The full-card editor no longer exposes the legacy single-note field.

### Manual submission and comment management (current)

Autosave is removed. “提交备注” creates a new entry, “编辑” loads one entry and “保存修改” updates it in place; Cancel discards only the draft. Every entry, including the legacy note, supports deletion with a confirmation prompt. Empty edits cannot be submitted. Notes remain answer-only during study. Explicit comments arrays now replace the stored array so deletion persists; omitted comments still preserve stored values for older clients. Revision checks guard concurrent writes. Refresh open pages after deployment to stop old autosave code. The prior autosave section describes superseded behavior.

## Image/text cards

Cards may reference up to six PNG/JPEG/WebP images (5 MB each), each with a caption and front/back placement. Default is back. Uploaded/generated bytes are kept under persistent `images/<hashed-owner>/<sha256>`; all reads/uploads require the existing authenticated proxy identity. IDs are strictly validated and external URLs/SVG are not accepted. Removal detaches references; files remain for backups/recovery (orphan cleanup is not automated). Back up the entire persistent directory. Website JSON export embeds referenced image bytes under `imageFiles`; this does not add a JSON import UI.

AI card generation returns an optional `imagePrompt` per card. Nonempty prompts trigger sequential image generation requests after text drafts appear; errors preserve editable text drafts. Existing cards can request a diagram in their editor. Images API uses separately configurable `imageModel` (default `gpt-image-1.5`) and the existing encrypted API Key. Request: `/v1/images/generations`, n=1, 1536x1024, medium, webp; decode data[0].b64_json and persist locally. One active request per owner, 80-second timeout (Nginx 90 seconds). No automatic paid retry. Timed-out provider requests may still incur charges. Check generated diagrams before saving, especially scientific relationships/labels.

API parameters and model compatibility checked with Context7 and official reference: https://developers.openai.com/api/reference/resources/images/methods/generate . No SDK/new dependency added. Image model access is account-dependent; status only reports configuration. Old clients omitting images preserve references on this server; older server releases may strip them, so prefer forward fixes after images are saved.

## Verified AD–AS illustrations

Economic-curve requests now go through the configured text model (Responses strict JSON schema) to check semantic applicability. The first supported case is a permanent demand increase from natural output, followed by upward short-run supply adjustment back to the same natural output. Label/assumption mismatches are rejected with 422; unsupported economic diagrams do not fall back to unverified raster generation. Other illustrations retain the existing image-generation path. No new dependency or API format was introduced.

`lib/economic-diagram.ts` defines deterministic illustrative coordinates, checks all three intersections, slopes, output recovery and price ordering, and renders a static two-panel SVG. No model-provided SVG/text is executed or interpolated. Only the internal renderer can create SVG assets; uploads still reject SVG. Generated SVGs share owner isolation, content hashing, private caching and restrictive CSP with other image assets. The image schema additionally accepts `image/svg+xml` for these internal diagrams; export includes their bytes.

Economic reference: OpenStax Principles of Economics 3e, §26.1, Figure 26.4: https://openstax.org/books/principles-economics-3e/pages/26-1-the-building-blocks-of-neoclassical-analysis . Card notation uses E₁/E₂/E₃ and Pf/P₁/P₂. Coordinates are schematic, not quantitative data.

Validation: 33 Node tests, TypeScript check and standalone production build; browser-rendered image inspected for curve intersections, labels, arrows and Chinese text. This narrowly verified template does not guarantee correctness of other economic diagrams.
