# Verification results

Verified against a real local MongoDB 8 replica set, Node 22.12, the installed dependency lockfile, and the React production build. Browser checks used the machine's existing Chromium through Playwright. No live external email, S3, bank, WhatsApp automation, or AI service was used.

| Check                                     | Result                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm test`                                | **35 passed, 0 failed**                                                                                       |
| `npm run build`                           | Backend TypeScript and frontend TypeScript/Vite production build passed                                       |
| `npm run test:e2e` against built frontend | **7 passed, 0 failed**                                                                                        |
| PWA production smoke check                | Service worker activated, five app bundles precached, offline shell loaded                                    |
| Private cache check                       | No `/api` response or attachment in service-worker cache                                                      |
| Printable PDF check                       | Chromium generated a valid 120,973-byte A4 report                                                             |
| Dashboard mobile layout                   | No horizontal overflow at 320, 360 or 390 px                                                                  |
| Narrow settings/report entry flows        | Browser-tested at 320/390 px                                                                                  |
| Phone module/report sweep                 | Eleven modules at 320/360/390/430/768 px; all thirteen report types at 320 px                                 |
| Phone navigation and entry dialog         | Search, More menu, attendance cards, 44 px touch targets, 390×460 short viewport and 740×360 landscape passed |
| Current dependency advisory check         | Unverified: registry network request failed/timed out                                                         |

## Latest application review

The full local review on 31 October 2026 passed **35 server tests and 7 browser workflows** against the production frontend. Both builds passed. A new browser case reproduced and then verified a fix for changing workers during wage approval: previous selections are cleared, only the current worker's attendance is submitted, approved cost increases once, and cash is unchanged. Details, release requirements and a prioritized feature plan are in [APP_REVIEW.md](APP_REVIEW.md).

The isolated production listener also passed `npm run check:deployment`. The root `.env` still contains placeholder Atlas credentials, so the local tests used an explicit process-only local replica-set URI. No Atlas connection, real external email delivery, S3 persistence, physical-device behavior or public deployment is claimed by these passes. The current dependency advisory check encountered network access errors/timeouts; the earlier audit result is not a fresh security verification.

For an isolated built-frontend browser run, start the API with `APP_ORIGIN=http://127.0.0.1:5180`, start `npm run preview -w client -- --port 5180 --strictPort`, and set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5180` before `npm run test:e2e`. The PWA/PDF check accepts the same URL: `node scripts/verify-production.mjs http://127.0.0.1:5180`. Run checks against a stable API process (`npm run start -w server`) while inspecting or editing source.

## Render deployment preparation

On 31 October 2026, the production build and server suite passed after adding single-origin frontend hosting, Render configuration, startup validation and database-aware health checks. Production checks against a separate local listener (`NODE_ENV=production`) passed for database health, built JavaScript, direct application links, cache headers, service-worker delivery, unauthenticated API behavior and exclusion of private configuration. Run `npm run check:deployment -- https://your-app.onrender.com` to repeat the read-only checks against a real deployment.

The `.env` Atlas URI still contains placeholders, so `npm run check:atlas` correctly reports that Atlas is not configured. No Render service has been created, no real Atlas connection has been verified, and no public deployment URL exists yet. Hosting account access and a real database URI remain required. The Render Blueprint includes a paid Starter service with a persistent upload disk. No paid resources have been provisioned.

## Financial and authorization coverage

The tests cover integer paise, deterministic item/wage rounding, proportional credits across many tiny line items, date-only validation, bill/payment separation, the ₹40,000/₹15,000/₹10,000 acceptance example, advance allocation without a second cash flow, credits versus refunds, persistent idempotency keys, conflicting request keys, transactional rollback, concurrent overpayment prevention, and immediate-payment transaction retries.

Additional tests cover tenant isolation, foreign vendor/attachment references, viewer writes, missing CSRF tokens, hostile Origin headers, one attendance entry per worker/date, one wage approval per attendance period, preserved historical rates after worker edits, immutable financial entries, compatible-unit stock receipts, duplicate receipts, negative stock rejection, upload signature checks, private file access, category-filtered dashboard/export agreement, pagination, formula-safe CSV, email-bound invitations, contributor role restrictions, revocation of unused invitations, expired reset tokens, single-use reset links and session revocation.

Filtered dashboard totals select whole bills and show payments allocated to those bills. A dedicated test ensures a payment split across two invoices does not count the other invoice's cash in a category selection. Project budget, remaining budget and advances retain their explicitly labelled all-time basis.

## Browser workflows

1. **390 px homeowner workflow:** register → create project → create ₹40,000 bill with ₹15,000 paid → record and allocate another ₹10,000 → verify ₹40,000 cost / ₹25,000 paid / ₹15,000 outstanding → download the matching final CSV.
2. **Desktop demo:** enter a clearly labelled isolated demo → open every module → filter the dashboard to cement and verify ₹40,000 cost / ₹25,000 allocated / ₹15,000 outstanding → clear the filter → save a progress update. No uncaught browser errors.
3. **Reliability and mobile preferences:** let a bill commit but deliberately interrupt its response → reload the draft → retry with the persisted request key → verify exactly one bill exists → upload a private PNG that the server converts to JPEG → save/display a progress photo → switch core UI to Hindi and dark mode → verify the 320 px layout.
4. **Narrow account screens:** check landing, login, registration and password recovery at 320/390/430 px, including readable input sizes and horizontal overflow.
5. **Phone and tablet modules:** check all eleven modules at five widths, all thirteen report types at 320 px, readable controls and report cells, and no uncaught browser errors.
6. **Touch navigation and short viewport:** search project records, open and close More navigation, inspect attendance cards, fill a partial-payment expense, verify touch target sizes and the Save action at 390×460, then check the 740×360 landscape layout.
7. **Worker-switch wage approval:** select attendance for one worker, change to a second worker, approve the second worker's attendance, and verify only its linked labour bill increases recorded cost while cash stays unchanged.

The complete suite and production smoke checks passed again on **31 October 2026** after the [phone layout update](MOBILE.md). Physical Android and iPhone/Safari checks remain unverified.

The core browser suite blocks service workers so deliberate request interception is deterministic. A separate production smoke script runs with service workers enabled and checks real cache entries and offline navigation.

## Reproduce

Start MongoDB and the API/frontend as described in the README. Then:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

For browser checks against the production frontend, keep the API running, stop the Vite development server, then:

```powershell
npm.cmd run preview -w client -- --port 5173
```

In another terminal:

```powershell
npm.cmd run test:e2e
node scripts/verify-production.mjs
node scripts/preview.mjs
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using an existing browser, or install Playwright's Chromium with `npx playwright install chromium`. The test database has a randomized `gharkhata_test_*` name and is cleaned after tests; the development database is preserved. Browser-created sample accounts/projects remain private test data in the development database.

Screenshots are in [screenshots](screenshots/): [desktop](screenshots/dashboard-desktop.png), [390 px](screenshots/dashboard-390.png), [360 px](screenshots/dashboard-360.png), [320 px](screenshots/dashboard-320.png), and [mobile expenses](screenshots/expenses-mobile.png).

The build reports non-blocking Rollup warnings about dependency comment annotations in Zod; bundling completes successfully. The API server ran in development mode locally. HTTPS hosting, production secure-cookie behavior through a real reverse proxy, live SMTP/S3 delivery, disaster recovery against an external backup, and multi-instance production load were not exercised. Deployment/backup procedures and optional-feature limits are documented separately.
