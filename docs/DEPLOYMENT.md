# Deployment and recovery

This app has a conventional Node/MongoDB backend. It is not a Cloudflare Worker application. The local delivery does not provision hosting, a database, SMTP, or an object-storage account.

## Render with MongoDB Atlas

The root [render.yaml](../render.yaml) runs the frontend and API together as one Node web service. Express serves `client/dist` and handles `/api` on the same HTTPS origin, including direct links to application pages. No separate frontend hosting or reverse-proxy configuration is needed on Render.

The Blueprint selects a **paid Starter service and a 1 GB persistent disk** for private uploads. Review Render's current charges before creating it. No paid resource has been created by adding this file. Render's free filesystem does not preserve uploads across restarts; use durable S3 storage if choosing a different service configuration.

1. Push the source to your Git repository, excluding `.env`, `node_modules`, `.runtime`, `uploads`, and build/test output. If using the prepared source ZIP, extract it into a new repository first.
2. In Atlas, create a database user with read/write access to the `gharkhata` database. Copy the **Connect → Drivers → Node.js** connection string, supply the real username/password, and set its database to `gharkhata`. Percent-encode special characters in the username/password. Add the Render service's outbound IP ranges to the Atlas project's **Network Access** list. Your laptop's allowed IP alone does not allow Render to connect.
3. In Render, choose **New → Blueprint**, connect that repository, and select `render.yaml`. Enter the real `MONGODB_URI` when prompted. This value belongs in Render's secret environment settings. Local `.env` files are not uploaded.
4. The Blueprint installs dependencies, checks/builds the app, removes development dependencies, and starts `npm start`. Leave Root Directory at the repository root. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; the application uses that URL as its allowed origin. For a custom domain, set `APP_ORIGIN` to the exact HTTPS origin with no trailing slash.
5. Uploads go to `/var/data/uploads` on the persistent disk. The health check is `/api/health`; it returns 503 if the database is disconnected. HTML, the service worker and manifest revalidate; hashed assets use immutable caching.
6. When deployment succeeds, open the returned HTTPS URL. Register a test account, add a project/bill/payment, upload a receipt, reload a direct `/app/expenses` URL and download a report. Configure and test SMTP before relying on reset or invitation emails. Existing local accounts, records and receipts are not migrated automatically.

For a local Atlas connection check, save the real URI in the root `.env`, allow the laptop's IP in Atlas, and run `npm run check:atlas`. This reads connection metadata and pings the database; it does not create or modify records. It never prints the connection string. Local development uses `APP_ORIGIN=http://127.0.0.1:5173`; Render uses its HTTPS URL.

Production settings are illustrated in [.env.production.example](../.env.production.example). The service refuses production startup with missing/placeholder database settings, a non-HTTPS origin, no explicit storage location, or a missing frontend build.

References: [Render Node deployment](https://render.com/docs/deploy-node-express-app), [Blueprint configuration](https://render.com/docs/blueprint-spec), [persistent disks](https://render.com/docs/disks), and [Atlas driver connections](https://www.mongodb.com/docs/atlas/driver-connection/).

## Production topology

Serve the Vite build and proxy `/api` to Express from one HTTPS origin. Use MongoDB Atlas or an authenticated replica set. MongoDB standalone cannot provide the transactions required for financial writes. Persistent disks or a private S3-compatible bucket are required for attachments.

```text
Browser / installed PWA
        │ HTTPS, one origin
   reverse proxy
    ├─ /assets, / → client/dist (SPA fallback)
    └─ /api       → Node/Express → MongoDB replica set
                              └→ private files / S3
```

1. Install Node 22.12+ and dependencies using `npm ci` from the root. Keep the lockfile.
2. Set server environment variables from `.env.production.example`. `NODE_ENV=production`, an exact HTTPS `APP_ORIGIN` (or Render's automatic `RENDER_EXTERNAL_URL`), and a production `MONGODB_URI` are required. Configure SMTP before enabling account recovery or collaboration email. Use a workload IAM role for S3 where available.
3. Run `npm run build`. This checks both workspaces, builds frontend assets, and creates a content-versioned service worker that precaches the shell. The server runs TypeScript using its declared `tsx` runtime dependency.
4. Run `npm run start -w server` under a supervised process/container. Production binds `0.0.0.0` unless `HOST` overrides it. Restrict inbound API access to the proxy/network as appropriate.
5. Express serves `client/dist` with SPA fallback and the headers below in production. Point your HTTPS reverse proxy at the Node service. If you instead use a separate static host, proxy `/api` without changing its path and route client pages (`/app/*`, `/login`, `/invite`, `/reset-password`) to the SPA.
6. Set `TRUST_PROXY` to the exact known proxy hop count, e.g. 1 for one trusted reverse proxy. This controls IP-based throttling. Use shared edge throttling when scaling to multiple Express instances; the included limiter is process-local.
7. Verify login, secure cookie attributes, a bill/partial payment, private receipt access, a CSV export, and reset/invitation email using test accounts before storing real records.

Suggested static headers:

```text
/index.html, /sw.js, /manifest.webmanifest  Cache-Control: no-cache
/assets/*                                Cache-Control: public,max-age=31536000,immutable
```

The frontend currently requests DM Sans/Manrope/Noto Sans Devanagari from Google Fonts, with local font fallbacks. If a deployment requires fully self-hosted fonts, host those licensed font files in `client/public` and replace the CSS import. Set a compatible static Content-Security-Policy for your font hosting, images and same-origin API. The API sets Helmet headers; attachment responses set a sandboxed policy.

## Private storage

Without `S3_BUCKET`, bytes are written to `UPLOAD_DIR` (root-relative by default). Mount that directory on a persistent volume. Do **not** add a static route exposing it. Back it up with MongoDB metadata. All access passes through a membership-checked API route.

For S3: configure bucket, region, optional endpoint/path style, and backend IAM credentials. Use a private bucket with public access blocked; allow the backend only PutObject/GetObject/DeleteObject as needed. These are server-to-storage requests, so no browser bucket CORS is required. TLS is recommended. Bucket encryption and object versioning should follow the operator's retention policy.

The local and S3 implementations use the same opaque UUID keys. To migrate, copy bytes preserving keys, verify counts/checksums against attachment metadata, then switch the adapter during a write-maintenance window. Do not change keys stored in MongoDB.

## Database setup

Startup initializes schema indexes before listening. For controlled index rollout, provision indexes from `models.ts` in the deployment migration pipeline before starting new instances. Financial writes lock a project revision document; this serializes writes to one household while allowing different projects to proceed independently.

Keep production database credentials out of source/frontend bundles. Use a scoped database user, authenticated replica-set access, TLS and network rules. Preserve idempotency records along with the ledger during backup/restore. Deleting them allows old request keys to post again.

## Backup and restore

Use MongoDB Atlas backup snapshots or MongoDB Database Tools (`mongodump`/`mongorestore`) against the authenticated replica set. Supply the connection URI through the process environment or your secret mechanism; avoid pasting production credentials into shell history.

Example PowerShell with an operator-provided `MONGODB_URI` (the tools may prompt or use a secret-injected environment):

```powershell
mongodump --uri $env:MONGODB_URI --archive=gharkhata-backup.archive --gzip
```

Take a coordinated attachment snapshot during the same write-maintenance window, or enable object versioning/point-in-time snapshots and record the snapshot time. Encrypt backups, restrict access, and store them off-host. Include users, memberships, sessions/tokens, ledger records, vendors, attachments, audit events and idempotency keys. Use a documented retention period appropriate to the owner's records.

To test recovery, provision a **new isolated database and storage location**, configure an isolated application environment, and restore there. Verify the resolved destination is the recovery database, then run:

```powershell
mongorestore --uri $env:RECOVERY_MONGODB_URI --archive=gharkhata-backup.archive --gzip
```

Do not use `--drop` against an active production database. Restore private object bytes preserving keys. Compare document/object counts and re-run acceptance scenarios in the restored environment. Check `recorded cost − net cash = outstanding − advances`, category totals, CSV/dashboard totals, scoped file access and membership roles. Rotate/revoke restored session and reset tokens before a real recovery cutover. Document recovery time and any gap between database/storage snapshots.

## Operational scope

The demo endpoint creates persistent fictional accounts/projects and is rate limited. For public use, deploy the demo in a separate environment or add retention cleanup scoped strictly to `demo:true` projects and their records, sessions and objects. Do not mix operational cleanup with real households. Unreferenced uploads require a retention job that first verifies no project cover or live/history record references the attachment.

There is no integrated virus-scanning service, hosted email provider, S3 account, automatic backup service, distributed rate limiter or monitoring vendor provisioned by this repository. Configure and verify these as part of the chosen deployment. JSON error logs redact request/identity content. Monitor 5xx rates, database transaction retries, storage failures, backup success and disk capacity.
