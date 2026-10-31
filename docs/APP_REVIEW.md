# GharKhata working check and adoption plan

Reviewed on 31 October 2026. This review covers the local application and source. It does not certify an Atlas or public Render deployment.

## Current findings

- The root `.env` still has placeholder Atlas credentials. The cloud database connection remains unverified. The local frontend was reachable at the start of this review, while its API was not running.
- Verification used the existing local MongoDB replica set, with an explicit process-only connection override. The saved Atlas settings were preserved. The production frontend was tested on an isolated preview port so the existing development frontend could remain available.
- The backend suite passed all 35 tests. Coverage includes financial reconciliation, partial payments, advances/credits/refunds, concurrent overpayment prevention, idempotency, role and project isolation, private uploads, stock, attendance, password resets, production startup validation and static hosting.
- The frontend and backend build passed. The PWA check verified five precached bundles, offline shell navigation, exclusion of private API data from cache, and a valid printable PDF.
- The original browser suite covers account/project creation, bills and partial payments, matching exports, interrupted-request recovery, private progress photos, Hindi/dark mode, eleven modules at five widths and thirteen report types. A new regression case adds worker switching during wage approval. Final browser results are recorded in [VERIFICATION.md](VERIFICATION.md).

## Bug corrected during the review

In the wage approval dialog, selecting attendance for worker A and then switching to worker B retained A's selection in hidden form state. The preview showed B's amount, but submission sent both workers' attendance. The backend correctly rejected the request with `Attendance belongs to another worker`; no mixed-worker wage bill was committed.

Changing the worker now clears the selection. Submission also limits IDs to that worker's currently displayed unbilled attendance. The new browser regression verifies that only worker B's attendance is approved, recorded cost increases by the approved wage, cash remains unchanged, and worker A is not billed.

A separate browser sweep was interrupted by an API development-server restart. The trace recorded a proxy connection refusal. The final run uses a stable server process; this is distinguished from the reproducible wage-selection bug.

## Work needed for a public launch

1. Supply real Atlas credentials, verify the connection and allow the hosting service's outbound IPs. Creating a database name in the Atlas UI alone does not connect this app.
2. Deploy the prepared Render service and verify its real HTTPS URL, secure-cookie behavior, direct links, private uploads and reports. Its Blueprint selects a paid service and persistent upload disk. No public deployment is claimed by this review.
3. Configure SMTP and verify actual password-reset and invitation delivery. Development email previews are working test tools; external email delivery is not configured.
4. Verify durable upload storage, a coordinated database/file backup and an isolated restore before storing important household records. S3 remains optional if the persistent disk is used correctly.
5. Check a physical Android phone and iPhone/Safari, including camera capture, keyboard, installation and safe-area behavior. Chromium emulation does not cover these device behaviors.
6. Exercise a larger ledger and concurrent households before claiming large-scale readiness. The UI currently loads the full project snapshot and performs many interactions locally; a paginated API exists, but large-ledger UI/server aggregation work remains.
7. Repeat the dependency advisory check from a network that can reach npm. The current attempt failed first under network restrictions and then timed out after escalation. A fresh zero-vulnerability result is not claimed.

The offline shell and device-local expense draft already exist. Full offline project access and automatic synchronization are not implemented. Several longer explanations remain English even when core labels are Hindi.

## Features to prioritize

These are product hypotheses to validate with homeowners and small contractors, not guarantees of user growth. Existing features such as reports, multiple projects, attendance, stock and basic team roles are already present.

| Priority | New capability                                                             | User value                                                                                                                                              | Dependencies and boundaries                                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Quick-entry favorites and project templates                                | Reuse the last supplier/category; start with home, renovation, kitchen or bathroom stages. Reduce the work needed to record the first and next expense. | Build on the existing bill form and project types; measure actual entry time and completion.                                                                                                                           |
| 1        | Excel/CSV import with preview                                              | Bring an existing ledger into the app instead of asking users to retype months of spending.                                                             | Column mapping, clear date/rupee conversion, row errors, duplicate protection and an explicit distinction between bills and payments.                                                                                  |
| 1        | Family/owner read-only summaries and WhatsApp report sharing               | Help the person paying and the person managing the site stay aligned; invite another participant through a useful report.                               | Existing roles and manual progress sharing are the base. Any new share link needs limited scope, expiry, revocation and control over names/receipts. Automated WhatsApp delivery would require a separate integration. |
| 2        | Complete Hindi experience and short in-app walkthroughs                    | Help users understand forms, validation errors, financial terms and the first-project flow.                                                             | Finish current Hindi explanations before choosing additional languages from pilot demand.                                                                                                                              |
| 2        | Receipt-photo and Hindi voice drafts                                       | Reduce typing at the site by proposing date, supplier, amount and category from a photo or spoken note.                                                 | Real OCR/transcription integration and operating costs. Show uncertain fields and require review before creating financial records. Attachments alone do not currently extract data.                                   |
| 2        | Full offline entry and reliable sync                                       | Let users work during poor connectivity and see which entries are pending or confirmed.                                                                 | Larger project: durable queue, per-user separation, idempotency, attachment retries, conflict handling and explicit reconciliation. Financial totals must distinguish confirmed from pending work.                     |
| 3        | Bill of quantities, supplier quote comparison and approved change tracking | Compare quotations on quantities, units, delivery and tax, then see how approved scope changes affect the plan.                                         | Use user-entered quotes with dates; budgets/commitments stay separate from incurred bills.                                                                                                                             |
| 3        | Home handover, warranty and maintenance diary                              | Continue providing value after construction ends through documents, appliance/waterproofing warranties and maintenance reminders.                       | Separate scheduled maintenance from construction costs and preserve export access.                                                                                                                                     |

## Adoption experiment

Start with 10–20 homeowners or small contractors who currently use a notebook, Excel or WhatsApp. Observe them creating a project and entering their first real expense. Track project creation, first confirmed expense, first week with repeated entries, a report shared, an invite accepted and a participant returning the following week. Collect feedback through an opt-in flow without recording receipt contents or private financial amounts in analytics.

Ship quick entry, import and useful sharing in small increments, then compare completion and repeat use. Provide a clear initial free-use allowance if introducing subscriptions; decide limits and pricing from the pilot and operating costs. Marketing can begin with a short Hindi demonstration and permission-based introductions through local contractors and building-material shops. Measure activated households and repeat use, alongside signups.

## Product context

[Powerplay](https://www.getpowerplay.in/) publicly lists construction materials, labour attendance, reports and expense management. [sitebook](https://www.sitebook.app/) describes renovation templates and read-only sharing without a recipient account. [SiteBook's project tools](https://web.sitebook.com.au/project-management2/) describe invoice OCR and configurable project templates. These are provider descriptions of their own features; they are not evidence that any proposed GharKhata feature will increase adoption. The recommendation to focus on easy entry, migrating existing ledgers and family sharing is an inference from this context and the current GharKhata feature set.
