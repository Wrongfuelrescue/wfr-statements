WRONG FUEL RESCUE — CONTRACTOR STATEMENTS
=========================================

This is the full source for the contractor statements app. Follow the
"Handover & Setup Manual" PDF that came with this package; it covers
everything below in more detail, plus four checks to run before you tell
contractors the site has moved.

WHAT THIS IS
------------
A Next.js application. Unlike the inventory dashboard, this is NOT static
files -- pages are generated on the server for each request, because every
screen shows one contractor's own rates and history. Netlify must BUILD it,
so a drag-and-drop deploy will not work. It has to come from a Git
repository.

QUICK START
-----------
1. Push this folder to a private GitHub repository.
2. In Netlify: Add new site -> Import an existing project -> pick the repo.
   Netlify detects Next.js and configures itself. Confirm the build command
   is "npm run build" and the publish directory is ".next".
3. Add the four environment variables (below) under
   Site configuration -> Environment variables.
4. Deploy, then run the four checks in the Setup Manual. Do not skip them:
   this app writes real financial records.

ENVIRONMENT VARIABLES
---------------------
AIRTABLE_TOKEN       Airtable personal access token. Needs READ AND WRITE:
                     data.records:read, data.records:write,
                     schema.bases:read. Grant it the WFR base only.
AIRTABLE_BASE_ID     appNMPu4UACVHBBbR
SESSION_SECRET       A long random string. Generate one with:
                     openssl rand -base64 48
MANAGER_PASSPHRASE   Passphrase for the /manage dashboard. Set this to the
                     Production context only. Use a long phrase, not a word
                     -- there is deliberately no lockout on that screen.

Redeploy after adding or changing any variable.

RUNNING IT LOCALLY
------------------
  npm install
  npm run dev          (http://localhost:3000)
  npm test             (636 tests)
  npm run build        (production build)

Put the four variables above in a file named .env.local for local work.
Never commit that file.

IMPORTANT -- DO NOT RENAME
--------------------------
The "Line Type" column on the Statement Lines table in Airtable has exactly
ten options, and the app writes to it BY NAME. If a name stops matching,
Airtable does not report an error: it quietly creates a second, near-
identical option and your reporting silently splits in two. Four of those
options use an en dash, not a hyphen. Do not rename them without changing
the code at the same time.

The app is already live and contractors are submitting real invoices.
Treat existing rows in Statements and Statement Lines as accounting
records, not test data.
