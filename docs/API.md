# GharKhata API

Base: `/api`. JSON requests use `Content-Type: application/json`; uploads use multipart `file`. Unknown fields are stripped by shared Zod schemas. Money is integer paise. Quantity inputs are decimal strings; dates are `YYYY-MM-DD`.

## Session contract

Registration/login returns `{ user, csrf }` and sets a seven-day opaque **HttpOnly**, SameSite=Lax session cookie. Only a SHA-256 token hash is stored in MongoDB. Production uses `Secure; __Host-gharkhata; Path=/`. Keep frontend and API on the same HTTPS origin.

Call `GET /auth/me` on load to obtain the current CSRF token. Send `X-CSRF-Token` on **every authenticated write**, including multipart uploads, logout and invite acceptance. Mutation Origin is checked against `APP_ORIGIN`. CORS allows that exact origin with credentials.

All project operations verify membership. Missing or foreign projects return 404. Viewer mutations return 403. Owner and manager may perform financial reversals, allocations, credits, refunds, wage approvals, budgets, contracts, stock movements and project configuration. Contributors may add bills, payments, vendors, workers, attendance, logs and tasks. Only owners manage invitations and membership revocation.

Use a stable UUID `Idempotency-Key` for project record, vendor, task and project-settings writes. Retrying an identical key/payload returns the original result. Reusing it for different data returns 409. Financial writes and their audit events commit together. Project creation itself does not use the project-scoped idempotency mechanism.

## Authentication

| Method | Route                   | Body / behavior                                                                                    |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| POST   | `/auth/register`        | `{name,email,password,language:'en'                                                                | 'hi'}`; minimum 10 characters, maximum 72 UTF-8 bytes |
| POST   | `/auth/login`           | `{email,password}`                                                                                 |
| GET    | `/auth/me`              | Current `{user,csrf}`; 401 when signed out                                                         |
| POST   | `/auth/logout`          | Revokes current session                                                                            |
| PATCH  | `/auth/profile`         | `{name,language}`                                                                                  |
| POST   | `/auth/forgot-password` | `{email}`; generic response, development-only email preview when configured for development        |
| POST   | `/auth/reset-password`  | `{token,password}`; 30-minute, single-use token; revokes all sessions and outstanding reset tokens |
| POST   | `/demo`                 | Isolated fictional user/project and session; rate limited                                          |
| GET    | `/health`               | Database connectivity status                                                                       |

## Projects and partners

| Method | Route                             | Behavior                                                                                                                                               |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/projects`                       | Only current member's projects, including role                                                                                                         |
| POST   | `/projects`                       | Validated project; creates owner membership atomically                                                                                                 |
| PATCH  | `/projects/:project`              | Full validated project settings; audit before/after                                                                                                    |
| GET    | `/projects/:project/snapshot`     | Consistent `{project,records,vendors,attachments,summary}`; storage keys omitted                                                                       |
| POST   | `/projects/:project/vendors`      | Create supplier/contractor profile                                                                                                                     |
| PATCH  | `/projects/:project/vendors/:id`  | Manager/owner profile correction, with audit                                                                                                           |
| GET    | `/projects/:project/records`      | Paginated searchable records; see filters below                                                                                                        |
| PATCH  | `/projects/:project/records/:id`  | Manager/owner edits to workers, budgets, agreements or diary logs; validates references and audits before/after; financial/stock entries are immutable |
| GET    | `/projects/:project/audit?page=1` | Most recent 50 audit events per page                                                                                                                   |

Record query parameters: `kind`, `q`, `page`, `limit` (1–100), `sort` (`newest`, `oldest`, `amount`), `from`, `to`, `vendor`, `category`, `floor`, `stage`, `status` (`paid`, `partial`, `unpaid`, `credited`), `min`, `max`. Amount filters use paise. Financial records include derived outstanding/status or available advance. `total` and current page are returned alongside records. The default dashboard is all-time. Its filter endpoint selects whole invoices and returns allocated payments toward that selection, with settlements through today. Budget and advance cards remain explicitly project-wide.

## Financial writes

`POST /projects/:project/records/:kind` uses the kind-specific shared schema.

Bill example (₹40,000 cost, ₹15,000 paid immediately):

```json
{
  "description": "Cement delivery",
  "date": "2026-11-01",
  "vendor": "<vendor ObjectId>",
  "lines": [
    {
      "description": "Cement",
      "category": "Cement",
      "quantity": "100",
      "unit": "Bag",
      "rate": 40000,
      "discount": 0,
      "tax": 0,
      "transport": 0,
      "other": 0
    }
  ],
  "paid": 1500000,
  "method": "cash"
}
```

`paid` is a creation command, not a redundant bill balance. The transaction creates an independent payment and allocation, and stores the computed bill line totals. Omitting the vendor creates/reuses a scoped `Cash purchase` payee.

| Kind         | Important fields                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `payment`    | `date,amount,vendor,payee,method,reference?,paidBy?,allocations:[{bill,amount}],notes?,attachments?` |
| `allocation` | `date,payment,bill,amount`; same vendor, enough available cash and outstanding cost                  |
| `credit`     | `date,bill,amount,reason`; reduces cost and outstanding, not cash                                    |
| `refund`     | `date,payment,amount,reason`; reduces cash and available advance, not cost                           |
| `worker`     | `name,trade,rate,vendor,phone?`                                                                      |
| `attendance` | `date,worker,units:decimal-string (0?24, up to 3 decimals),notes?`; one live record per worker/date  |
| `wage`       | `date,worker,attendance:[ids],description`; creates linked labour bill, no cash payment              |
| `budget`     | `dimension:'category'                                                                                | 'stage',label,amount`; one active allocation per dimension/label |
| `contract`   | `vendor,title,scope,amount,startDate,endDate,milestones:[{title,amount,date}],changes?,attachments?` |
| `stock`      | `date,material,unit,type,quantity,threshold?,bill?,line?,notes?`; line index is zero-based           |
| `log`        | `date,title,stage?,floor?,notes?,problems?,labourCount?,attachments?,captions?`                      |
| `task`       | `title,dueDate,assignee?,priority,status,stage?,checklist:[{title,done}],attachments?`               |

`POST /projects/:project/records/:id/void` with `{reason}` reverses/archives a record without deleting it. Dependent entries prevent voiding a bill/payment; reverse those first. Wage statements and stock movements use compensating records. `PATCH /projects/:project/tasks/:id` updates a task/checklist and audits before/after.

## Private attachments

`POST /projects/:project/attachments`: multipart field `file`, maximum 10 MB, JPEG/PNG/PDF signatures only. Images are decoded with a pixel limit, autorotated, stripped of metadata, resized within 2400×2400, and encoded as JPEG quality 88. PDF originals are preserved; PDFs with detected active-content markers are rejected. Random storage keys prevent filename traversal. Authentication, upload throttling and write membership are enforced before parsing the upload.

`GET /projects/:project/attachments/:id`: authenticated project-scoped bytes, `private, no-store`, `nosniff`, sandboxed content policy. Files are not served from a public uploads directory. Removed form selections can leave unreferenced uploads; apply an orphan-retention job in production without removing referenced records.

## Collaboration

| Method | Route                                | Behavior                                                                     |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------- | ------------- | ------------------------------------- |
| GET    | `/projects/:project/members`         | Member display profiles and roles                                            |
| POST   | `/projects/:project/invitations`     | Owner: `{email,role:'manager'                                                | 'contributor' | 'viewer'}`; seven-day single-use link |
| GET    | `/projects/:project/invitations`     | Owner: pending invitations, never token hashes                               |
| DELETE | `/projects/:project/invitations/:id` | Owner revokes unused link                                                    |
| POST   | `/invitations/accept`                | `{token}`; signed-in email must match; preserves an existing membership role |
| DELETE | `/projects/:project/members/:id`     | Owner revokes member and unused invite links; cannot remove owner            |

## Reports

`GET /projects/:project/export?type=final` returns UTF-8 BOM CSV with formula-injection protection for cells beginning with formula characters, including leading whitespace. Types: `bills`, `payments`, `outstanding`, `vendor`, `labour`, `category`, `stage`, `floor`, `monthly`, `budget`, `final`, `progress`, `data`.

Optional `from`, `to`, `vendor`, `category`, `floor`, `stage`, `status` for bill selection. Bill reports select by bill date; linked settlements/credits are current all-time values for those bills, not an as-of balance. Ledger/payment reports select transaction dates. Category/stage/floor/budget reports group selected bills after current credits. Monthly reports select whole months and show event-date cost/cash. Project totals in the final report are explicitly all-time. Vendor filtering applies to bill, payment/ledger and bill-grouping reports. Labour, progress, data and monthly reports are project-wide. The UI provides printable equivalents with browser PDF saving.

## Errors and operational behavior

JSON errors: `{error:string}`. Status 400 validation/reference/over-allocation, 401 signed out, 403 role/CSRF/origin, 404 inaccessible/missing resource, 409 duplicate/conflicting state, 429 rate limit, 503 missing email transport in production. Unexpected errors return a redacted generic 500 and log only error type/code. Request bodies and monetary/identity data are not logged.

Indexes are initialized during startup: unique emails/session and token hashes; unique `(project,user)` memberships; `(project,kind,date)` records; project lookup indexes; project/time audit index; unique `(project,key)` idempotency records; TTL for sessions and reset/invitation tokens. Expiry is checked in queries, independently of TTL cleanup timing.
