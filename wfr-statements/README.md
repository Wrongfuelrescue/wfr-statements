# WFR Contractor Statements

A Next.js app that lets Wrong Fuel Rescue's ~21 contractors sign in (name +
6-digit PIN), itemise a fortnight's work or a month's performance bonuses,
and generate a PDF. That PDF is also written back to Airtable so WFR
accounts can reconcile against it.

**The generated PDF is the contractor's own invoice to WFR — not a WFR
document.** It carries the contractor's own ABN, business address and bank
details, is headed `TAX INVOICE` for a GST-registered contractor and
`INVOICE` for one who is not, and carries no WFR branding or logo. This is a
change from v1, where the app produced a WFR-branded *supporting statement*
("not a tax invoice") that the contractor attached to an invoice they issued
separately, outside this app. As of v2 there is no separate invoice — this
app's output **is** the contractor's invoice. Treat it accordingly: these
back real payment claims.

WFR's own details — the party being invoiced — live in
[`lib/invoice/payee.ts`](lib/invoice/payee.ts) as a plain constant, not
environment variables. They are stable, non-secret, and identical in every
environment; a constant is version-controlled and visible in code review,
whereas an unset environment variable would silently render an invoice with
no payee at all.

For a document to be a **valid** tax invoice, the contractor's own `ABN`,
`Address`, `Bank Account` and `Bank Account BSB` fields must be populated on
their INVOICE MATRIX row in Airtable (see
[`docs/airtable-schema-setup.md`](docs/airtable-schema-setup.md)). The app
does not block submission when they're missing — a GST-registered contractor
with no ABN on file still submits, but produces a tax invoice WFR cannot
claim a GST credit against, flagged as a `Warnings` entry on the Statements
record rather than a rejection, since only WFR (not the contractor) can fix
it. All four fields are blank for every contractor as of v2's release; watch
that column until WFR finishes populating them.

## Environment variables

Four are required. Copy `.env.example` to `.env.local` and fill them in for
local development; the same four must be set wherever this is deployed.

| Variable | What it is | How to get it |
|---|---|---|
| `AIRTABLE_TOKEN` | A Personal Access Token for the WFR Airtable base, with read/write scopes on records and schema for the base below. | Airtable → Developer Hub → Personal access tokens. Needs `data.records:read`, `data.records:write` and attachment upload access on base `appNMPu4UACVHBBbR`. |
| `AIRTABLE_BASE_ID` | The WFR base id. | `appNMPu4UACVHBBbR` (visible in the base's API docs, or in its URL). |
| `SESSION_SECRET` | Symmetric secret used to sign the login session JWT (see `lib/auth/session.ts`). Signs both the contractor session and the management session — see the management dashboard section below for why the two are still not interchangeable. | Generate one locally and keep it out of source control: `openssl rand -base64 32`. Rotating it invalidates every signed-in session. |
| `MANAGER_PASSPHRASE` | The passphrase for the management dashboard at `/manage`, which is read-only access to every contractor's pay data. There is deliberately no lockout on this login, so it must be **generated rather than chosen** — entropy is the whole protection. | Generate one and keep it out of source control: `openssl rand -base64 24`. Unset, the login fails closed and accepts nothing. |

Without all four set, the app cannot start meaningfully — but `npm run
build` is deliberately designed to succeed **without any of them present**
(see `dynamic = 'force-dynamic'` on the pages that read Airtable data): a
missing credential must fail at request time with a clean error, never break
the deploy pipeline itself. If you're validating a change without
credentials, `env -u AIRTABLE_TOKEN -u AIRTABLE_BASE_ID -u SESSION_SECRET -u
MANAGER_PASSPHRASE npm
run build` is the check to run.

## Getting started

```bash
npm install
npm run dev      # starts the dev server at http://localhost:3000
npm test         # runs the full test suite (vitest)
npm run build    # production build
```

`npm run lint` runs ESLint (`eslint-config-next`). Both `npm test` and `npx
eslint .` are expected to be clean — no failing tests, no console noise, no
lint errors — before anything is merged.

## Where things live

- `app/` — Next.js App Router pages and API routes. `app/api/login` and
  `app/api/statements` are the only two API routes; everything else is a
  server or client component.
- `lib/calc/` — pure calculation logic (fortnightly and monthly totals, GST,
  rounding). No I/O of any kind — file handling, network calls, everything
  that touches the outside world lives elsewhere and calls into here with
  plain data.
- `lib/airtable/` — all Airtable reads and writes. `lib/airtable/fields.ts`
  is the only file that knows Airtable table/field ids; everything else goes
  through the functions in this directory.
- `lib/pdf/` — the invoice PDF, built with `@react-pdf/renderer`
  (`StatementDocument.tsx`, rendered via `render.ts`). Carries no WFR
  branding — the WFR letterhead logo used in v1 was removed once the PDF
  became the contractor's own invoice rather than a WFR-branded statement.
- `lib/invoice/` — the invoice-specific rules that aren't pure calculation:
  `payee.ts` holds WFR's own details as the invoiced party (a constant, not
  environment variables — see above) and the `TAX INVOICE`/`INVOICE` heading
  logic based on GST registration.
- `lib/auth/` — PIN verification, login throttling, and the session cookie.
- `components/` — shared UI: the itemised claim summary (`ClaimSummary`),
  the running total shown while filling in a statement (`RunningTotal`), the
  review-before-submit screen, and the post-submit confirmation.

## Management dashboard

`/manage` is a **read-only** reporting layer over the same Airtable data, for
WFR management rather than contractors. No route under it writes to Airtable,
and it adds no table or field to the base.

Four screens:

- **Pay run** (`/manage/pay-run`) — the fortnight's totals, and who has and
  has not submitted. Contractors who have not submitted are listed as rows,
  not omitted; that outstanding list is the reason the screen exists.
- **GST** (`/manage/gst`) — GST charged to WFR for a BAS quarter (its input
  tax credit), paired with the GST it *cannot* claim because the invoice
  carries no supplier ABN.
- **Costs** (`/manage/costs`) — a quarter's spend by line-type category, city
  and van.
- **Exceptions** (`/manage/exceptions`) — the signals from "What WFR should
  watch for" in the schema doc, each with its Airtable-side fix.

Three things worth knowing before changing any of it:

**The fortnight cycle is one constant.** Contractors pick their own
fortnight-ending date, and Airtable records nothing about which Sundays are
real pay boundaries — `FORTNIGHT_ANCHOR` in `lib/manage/fortnight.ts` is the
only source of that truth. If WFR's real cycle runs on the other Sundays,
changing that one line is the entire fix. Every statement is bucketed into the
fortnight whose fourteen-day window contains its `Period End`, so a statement
with an off-cycle ending is shown and flagged rather than dropped from every
view at once.

**Management auth is distinguished from contractor auth by a `role` claim,
and only by that.** Both cookies are signed with the same `SESSION_SECRET`, so
a contractor's `wfr_session` token verifies cryptographically as a manager
token — `readManagerToken` rejects it solely because it carries no
`role: "manager"`. Removing that check would give every contractor read access
to every other contractor's pay. There is a test asserting exactly this; if it
ever starts failing, stop.

**Cost attribution by city and van is read live** from INVOICE MATRIX rather
than frozen onto each statement (the `Rate Snapshot` holds pricing only), so a
contractor who changes van re-attributes their whole history to the new one.
The costs page says so on the page.

## Airtable schema

The full live schema — every table and field this app reads or writes, plus
why several of the less obvious ones exist (`Contractor ID`, `Rate
Snapshot`, why `Status` is set last, why `Warnings` matters) — is documented
in [`docs/airtable-schema-setup.md`](docs/airtable-schema-setup.md). That
document is written so the base could be rebuilt from scratch if it were
ever lost; keep it in sync with any schema change.

## Deployment

Deploys to Vercel, matching WFR's other internal tools. Set the three
environment variables above in the Vercel project settings for every
environment (Production, Preview) that needs to actually reach Airtable —
Preview deploys without them will still build and serve the static shell,
they just won't be able to log a contractor in or load a rate card.

## Operations

Day-to-day questions — *what does a non-empty `Warnings` cell mean?*, *why is
this statement missing from the base?*, *how do I unlock a contractor who's
mistyped their PIN five times?*, *how do I set up a new contractor?* — are
answered in the **"What WFR should watch for"** section at the end of
[`docs/airtable-schema-setup.md`](docs/airtable-schema-setup.md#what-wfr-should-watch-for).
Read that before fielding a support question about a statement that looks
wrong or missing.

The short version, if you're triaging something right now:

- **`Warnings` mentions a missing ABN** → a GST-registered contractor
  submitted with no `ABN` on their INVOICE MATRIX row. Their invoice is
  headed `TAX INVOICE` but isn't one WFR can claim a GST credit against.
  Fix by adding their ABN in Airtable — nothing to resubmit.
- **`Warnings` non-empty for any other reason on a Statements row** → the
  statement's totals and lines are correct, but something after submission
  (usually the PDF or a receipt photo) failed to attach. The contractor
  likely still has their own downloaded PDF copy.
- **`Status` blank on a Statements row** → the write failed partway through
  and the row is incomplete. It's already hidden from the contractor's own
  "My submissions" list — don't reconcile against it.
- **Contractor locked out** → clear `Locked Until` on their INVOICE MATRIX
  row.
- **New contractor can't log in / "PIN not correct" for every attempt** →
  check whether `PIN` is blank on their INVOICE MATRIX row. A blank PIN can
  never match, by design.
