# Airtable schema setup

This documents the full Airtable schema backing the WFR contractor statements
app, as it exists in the live base, so it can be reproduced if the base is
ever rebuilt.

Base: **WFR** — `appNMPu4UACVHBBbR`

## INVOICE MATRIX (`tblEKgseTcvYkoBaH`)

Existing contractor rate table, extended in Task 15 with four fields to
support login and throttling. All new fields are referenced **by name** in
code (`lib/airtable/fields.ts` → `NEW_FIELDS`), not by ID, since Airtable's
write API accepts field names.

| Field name | Type | Purpose |
|---|---|---|
| `Email` | Email | Contractor contact / login identifier |
| `PIN` | Single line text | 6-digit login PIN |
| `Failed Attempts` | Number, precision 0 | Login throttle counter |
| `Locked Until` | Date with time, ISO, Australia/Sydney | Login lockout expiry |

v2 (invoice) adds four further fields — the contractor's own identity details,
needed because the generated PDF is now the contractor's own invoice rather
than a WFR-branded supporting statement. All four are referenced **by ID** in
code (`lib/airtable/fields.ts` → `FIELDS`), consistent with every other
pre-existing field on this table.

| Field name | Field ID | Type | Purpose |
|---|---|---|---|
| `ABN` | `fldPJYhQLpDjXt6j4` | Single line text | Contractor's own ABN, printed on their invoice. Required for the document to be a valid tax invoice when the contractor is GST-registered — see "What WFR should watch for" below. |
| `Address` | `fldfWCMFfCN8t7Ptt` | Single line text | Contractor's business address, printed on their invoice. |
| `Bank Account` | `fldVootsnyHDxRnn8` | Single line text | Contractor's bank account number, printed on their invoice for WFR to pay against. |
| `Bank Account BSB` | `fldZSPK2cDIysLtya` | Single line text | Contractor's bank BSB, printed alongside `Bank Account`. |

**All four are currently blank for every contractor.** WFR is populating them
separately, contractor by contractor. Until a given contractor's row has all
four filled in, their invoice PDF still generates and submits successfully —
it just prints with those details missing.

`Failed Attempts` and `Locked Until` hold the login throttle. They live on
the record rather than in process memory because the app runs on serverless
instances that do not share memory — an in-process counter resets on every
cold start and is bypassable by concurrent requests, which against a 6-digit
PIN is a real brute-force exposure. Both are left blank on all records; the
app treats a blank `Failed Attempts` as `0` and a blank `Locked Until` as
"not locked".

The pre-existing primary `Name` field, and `PIN`, are populated per-record
(one row per contractor); `Failed Attempts` and `Locked Until` are left blank
until a login attempt occurs.

## Statements (`tblaqyvsGwyHba8SD`)

One record per submitted statement (fortnightly work statement or monthly
bonus statement). All fields are referenced by name in code.

| Field name | Type | Options |
|---|---|---|
| `Statement` | Single line text | **Primary field.** Human-readable label, e.g. `HARLEY GATT — Fortnightly — 2026-07-21`. Populated by the app at submit time — see "Primary field population" below. |
| `Contractor` | Link to INVOICE MATRIX | Navigable link, shown in the UI |
| `Contractor ID` | Single line text | Plain-text mirror of the same contractor's Airtable record ID. See "Why `Contractor ID` exists" below. |
| `Type` | Single select | `Fortnightly`, `Monthly Bonus` |
| `Period Start` | Date, ISO | |
| `Period End` | Date, ISO | |
| `Subtotal` | Currency, AUD, 2dp | |
| `GST` | Currency, AUD, 2dp | |
| `Reimbursements` | Currency, AUD, 2dp | |
| `Total` | Currency, AUD, 2dp | |
| `GST Registered At Submission` | Single select | `YES`, `NO` |
| `Status` | Single select | `Submitted`, `Superseded`. Left blank on the initial create and set to `Submitted` only after every line batch has written successfully — see "Status is set last" below. |
| `Supersedes` | Link to Statements | |
| `Submitted At` | Date with time | |
| `Rate Snapshot` | Long text | JSON dump of the `RateCard` used to calculate this statement, captured at submit time. A later change to a contractor's rates in INVOICE MATRIX must never retroactively alter a statement that has already backed an invoice — this snapshot is the guard. |
| `PDF` | Attachment | Rendered statement PDF, attached after the record is created (see `attachPdfToStatement`) |
| `Reference` | Single line text (`fld6yTF3HRw3JYoAo`) | Human-quotable id (e.g. `INV-ATCVEXGZ`, see `lib/reference.ts`), generated before the PDF is rendered and printed on it. The PDF renders before this record exists, so it can never carry the record id itself — `Reference` is the only way back to this row from a printed or emailed PDF alone. Also shown per-row on the contractor's "My submissions" list (see Finding 6 below) so they can quote it over the phone. |
| `Warnings` | Long text (`fldegRdkuTSkNsHOx`) | Accumulated failure messages from everything that happens *after* the statement is marked `Submitted` — a failed PDF attach, a rejected or failed receipt upload, etc. (see `recordStatementWarning`). Left blank when nothing went wrong. **This is the only signal that a Submitted statement is missing part of its supporting evidence** — see "What WFR should watch for" below. |
| `Notes` | Long text (`fldqQVXkL1Ku2c1Ua`) | Contractor-supplied monthly free-text note (e.g. explaining an otherwise-ambiguous claim), written from `totals.note` in `createStatement`'s header create. Omitted entirely (not written as an empty string) when the contractor left no note. |

### Why `Contractor ID` exists

Filtering `listStatementsForContractor` by contractor initially used an
Airtable formula against the `Contractor` link field:
`FIND("recXXXX", ARRAYJOIN({Contractor}))`. This is wrong: in Airtable
formula semantics, referencing a link field returns the **linked record's
primary field text**, not its record ID. `Contractor` links to INVOICE
MATRIX, whose primary field is the contractor's `Name` — so that formula
compared a record ID against a string like `"HARLEY GATT"` and never
matched, and could in principle match the wrong contractor if an ID
substring ever appeared in a name.

`Contractor ID` stores the contractor's raw record ID as plain text
alongside the link, so `listStatementsForContractor` can filter with an
exact string match — `{Contractor ID}="recXXXX"` — with no formula
ambiguity. The `Contractor` link field is kept as well, purely so the
record stays navigable in the Airtable UI; only `Contractor ID` is used for
filtering.

### Status is set last

`createStatement` creates the header **without** `Status` set, writes every
line batch, and only after all batches succeed issues a `PATCH` setting
`Status: 'Submitted'`. If a batch throws partway through (a transient 5xx is
entirely plausible), the header is left with a blank `Status` rather than a
misleadingly complete-looking `Submitted` while some lines are missing. A
blank `Status` is visibly incomplete in the Airtable UI and is already
excluded by `listStatementsForContractor`'s `{Status}="Submitted"` filter, so
a partial write can never silently pass as a full statement WFR reconciles
against.

## Statement Lines (`tblyuiblozI2vbRwL`)

One record per calculated line item on a statement (one shift, one RDO, one
reimbursement, one bonus count, etc.), linked back to its parent Statement.

| Field name | Type | Options |
|---|---|---|
| `Line` | Single line text | **Primary field.** Human-readable label. Dated lines: `2026-07-21 Base Shift`. Dateless lines (monthly bonus lines, which are period-wide rather than day-specific): just the line type, e.g. `Google Review Bonus`. |
| `Statement` | Link to Statements | |
| `Date` | Date, ISO | Omitted (not written) for dateless monthly bonus lines |
| `Line Type` | Single select | `Sub Contractor Labour Hire`, `Sub Contractor Labour Hire – RDA Rate`, `Sub Contractor Labour Hire – Adjusted Hours`, `Sub Contractor Labour Hire – Additional Hours`, `Minor Service`, `Major Service`, `Reimbursement`, `Google Review Bonus`, `Fuel Filter Sales Bonus $30`, `Fuel Filter Sales Bonus $70`. **The separator is an en dash (U+2013), not a hyphen** — see below. |
| `Quantity` | Number, 2dp | |
| `Unit Rate` | Currency, AUD, 2dp | |
| `Amount` | Currency, AUD, 2dp | |
| `Description` | Long text | Omitted (not written) when blank |
| `Receipt` | Attachment | |

### The `Line Type` choices were renamed, and the old names still matter

These choices were renamed in Airtable after v2 shipped, into WFR's own
accounting terms. v3 aligned the app's `LineType` constants to match, so code
and base now agree — but the history does not:

| v2 wrote | Renamed to, and what v3 writes |
|---|---|
| `Base Shift` | `Sub Contractor Labour Hire` |
| `Rostered Day-off` | `Sub Contractor Labour Hire – RDA Rate` |
| `Adjusted Shift` | `Sub Contractor Labour Hire – Adjusted Hours` |
| `Additional Labour` | `Sub Contractor Labour Hire – Additional Hours` |
| `Fuel Filter $30` | `Fuel Filter Sales Bonus $30` |
| `Fuel Filter $70` | `Fuel Filter Sales Bonus $70` |

`Minor Service`, `Major Service`, `Reimbursement` and `Google Review Bonus`
were not renamed.

Renaming a single-select choice rewrites what every existing record reads as,
so the rename was retroactive — no stored line reads `Base Shift` any more.
Anything that groups or matches on `Line Type` should nonetheless **accept
both spellings**: `lib/manage/rollup.ts` does, because a mismatch does not
error, it silently classifies lines as unrecognised. Its tests assert that
every value in the `LineType` union maps to a real category, which is what
catches the *next* rename rather than only this one.

**The separator is an en dash (U+2013), not a hyphen.** Writes set
`typecast: true`, so a hyphen would not be rejected — Airtable would create a
second, near-identical choice and quietly fork WFR's reporting between them.
This has nearly happened once. If duplicate choices ever appear in the base,
that is the cause.

`typecast: true` also means a choice missing entirely from the base (e.g.
after a restore predating it) is created on first use rather than rejecting
the write, so none of these need to be pre-created by hand.

## Primary field population

Both new tables have a primary text field. In Airtable, an unpopulated
primary field makes every linked record show as blank wherever it's
referenced (e.g. the `Contractor` → `Statements` link, or the
`Statement` → `Statement Lines` link), which would make the base unusable
for WFR to actually reconcile against. `createStatement` in
`lib/airtable/statements.ts` populates both:

- `Statement`: `${contractor name} — ${Fortnightly|Monthly Bonus} — ${period start date}`
- `Line`: `${date} ${line type}` for dated lines, or just `${line type}` for
  dateless lines (monthly bonus counts, which apply to the whole period
  rather than one day)

## Batching

Airtable's record-create endpoint rejects batches larger than 10 records per
call. `createStatement` chunks Statement Lines writes into batches of 10 via
`BATCH_SIZE` in `lib/airtable/statements.ts`; a 40-line fortnight (e.g. 14
days × up to 3 line types) writes across multiple sequential batch calls
rather than one oversized call.

## Attachment upload

`attachPdfToStatement` uploads the rendered statement PDF after the
Statements record is created, via a separate endpoint:

```
POST https://content.airtable.com/v0/{baseId}/{recordId}/PDF/uploadAttachment
```

This is Airtable's dedicated attachment-upload endpoint (distinct from the
regular `api.airtable.com` record CRUD endpoint used by `airtableFetch`) and
addresses the attachment field **by name** (`PDF`) in the URL path. It reuses
the same `credentials()` helper as `lib/airtable/client.ts` rather than
reading `process.env.AIRTABLE_TOKEN` / `AIRTABLE_BASE_ID` independently, and
surfaces the HTTP status in the thrown error on failure rather than
swallowing it.

`attachReceiptToLine` uses the same endpoint shape, one level down, to attach
a reimbursement's receipt photo to its Statement Lines record's `Receipt`
field:

```
POST https://content.airtable.com/v0/{baseId}/{lineId}/Receipt/uploadAttachment
```

Both attachment uploads happen **after** the statement is already marked
`Submitted` (see "Status is set last" above), and both are best-effort: a
failure on either is caught, logged, and folded into a single `Warnings`
PATCH rather than failing the request — see "What WFR should watch for"
below for what that means operationally.

## What WFR should watch for

A handful of signals in this base tell you when a Submitted statement needs a
human look, or when a contractor is locked out or can't log in at all.

**Every statement-level signal below is now surfaced on the management
dashboard's Exceptions screen (`/manage/exceptions`), each with the fix
described here.** That page reads its wording from `lib/manage/exceptions.ts`
— keep the two in sync, because that screen is where this guidance actually
gets read.

- **A `Warnings` entry saying a contractor has no ABN on file is a
  financial problem, not a cosmetic one — watch this column.** It fires for
  *any* contractor with a blank `ABN`, GST-registered or not — an invoice
  with no supplier ABN obliges WFR to withhold 47% of the payment regardless
  of GST registration, and a GST-registered contractor's invoice also cannot
  be claimed against for a GST credit. As of this writing `ABN` is blank for
  every contractor (see INVOICE MATRIX above), so expect to see this warning
  on every invoice until WFR populates it. The app deliberately does not
  block the submission: the contractor has no way to fix it themselves (the
  field lives on INVOICE MATRIX, not anything they enter), so blocking would
  just leave them unable to submit at all. The fix is entirely on WFR's
  side: add the contractor's ABN to their INVOICE MATRIX row. Until every
  contractor's `ABN` is filled in, expect to see this warning repeatedly —
  it is not a one-off bug, it is the system telling you the data is missing.

  **To correct an already-submitted statement:** add the missing data to
  INVOICE MATRIX, set the old Statements row's `Status` to `Superseded`, ask
  the contractor to resubmit that fortnight, then set the new row's
  `Supersedes` link to the old row. Reconcile pay against the `Submitted` row
  only — the new invoice carries a new `INV-` number, and the superseded one
  must not be paid. This works because `findSubmittedStatement` filters on
  `{Status}="Submitted"`, and `Status` already carries a `Superseded` choice —
  setting the old row's `Status` to `Superseded` re-opens that period for
  resubmission, with no code change needed.

- **A non-empty `Warnings` cell on a Statements row means that statement
  needs a look.** The statement itself was still fully calculated and
  written — the totals and every Statement Line are correct — but something
  *after* that point failed: most often the PDF failed to attach, or a
  receipt photo was rejected (wrong file type, too large) or failed to
  upload. Read the `Warnings` text; it names the date and what went wrong.
  The contractor still has their own downloaded copy of the PDF (unless the
  PDF row was the one that failed), so the immediate fix is usually just to
  ask them to re-send it, or re-upload the missing receipt yourself once you
  have it from them.

- **A blank `Status` on a Statements row means the write failed partway
  through**, before every Statement Line was created — see "Status is set
  last" above. This is rare (it needs a transient failure mid-write, e.g. a
  dropped connection between line batches) but if you see it: treat the row
  as incomplete, do **not** reconcile against it, and check whether the
  contractor actually has a working PDF for that period (the app rejects a
  resubmission for a period that already has a *Submitted* statement, but a
  blank-`Status` row doesn't count as Submitted, so they can safely
  resubmit). This row is deliberately excluded from the contractor's own "My
  submissions" list — they will not see it and have no reason to think
  anything went wrong unless you tell them.

- **To unlock a contractor early**, before their 15-minute lockout expires:
  open their row in INVOICE MATRIX and clear `Locked Until`. Leave `Failed
  Attempts` as-is — the next login attempt (correct or not) resets it
  appropriately on its own (see `lib/auth/login.ts`), you don't need to
  clear it by hand.

- **To set a PIN for a new contractor**, put a 6-digit value in their `PIN`
  field on INVOICE MATRIX. **A blank `PIN` means that contractor cannot log
  in at all** — `verifyPin` explicitly refuses to match a submitted PIN
  against an empty stored one, even if the contractor were to submit an
  empty PIN — so a new row with no `PIN` set will show as "That PIN is not
  correct" for every attempt, not a more obviously diagnosable error. This is
  also the state a contractor's row is in before they've ever been given a
  PIN, so it's worth checking first if someone reports they "can't log in at
  all," as opposed to a lockout (which gives a different, clearly-worded
  message).
