# Dispatch — Driver Desk

A responsive delivery operations MVP for Irish teams. React + TypeScript on Vinext, running on Cloudflare Workers with shared D1 persistence. Hosted privately through Sites.

## Included

- Driver availability with preferred locations; weekly schedule; manager assignments; driver declines; available-driver cover requests with manager approval.
- Server-side role and ownership checks, full-shift availability validation, overlap prevention, and optimistic concurrency to avoid lost updates.
- Camera/image docket OCR with Tesseract.js in the browser; editable extracted address, Eircode and phone; paste-text and manual-entry fallback.
- Google Maps and Apple Maps directions, tap-to-call, pending/on-the-way/delivered/failed states, and independent paid/unpaid tracking.
- Configurable base + per-kilometre fees, frozen per delivery; earnings overview; searchable delivery ledger and CSV export.
- Optional example workspace with removable sample records. Production starts empty.

## Run locally

Use Node.js 22.13 or newer.

```sh
npm ci
npm run db:generate # only when changing db/schema.ts
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_quiet_jetstream.sql
npm run dev -- --hostname 127.0.0.1
```

Visit http://127.0.0.1:5173 and choose a local sign-in account. The loopback-only development sign-in supports Seedy (`seedy@sites.test`) and Suzanne Murphy (`suemurphy24@gmail.com`), whose configured system-wide Super User access is also applied locally. Hosted authentication uses ChatGPT identity supplied by Sites. Local and hosted databases are separate.

```sh
npm test
npm run typecheck
node tests/http.mjs # requires the dev server and an empty local database
```

## Team setup

The first authenticated visitor to the initially owner-private Site becomes an Admin. Open it yourself before granting other people access. In Team, add each person using the exact email they use to sign in, optionally include their mobile number, and choose Driver or Admin access; existing team members can also be promoted to Admin. Separately grant them viewer access through Site sharing; adding a team member never sends an invitation. Do not grant Site editor access unless they should edit application source. Email matching uses trusted authenticated identity headers. Drivers are restricted to their own delivery records and availability. Admins can see and manage all records, including final shift assignments and cover approvals. At least one Admin or Super User must remain on the workspace.

The configured Super User identities in `lib/system-access.mjs` are automatically enrolled with full access when they sign in to any workspace running this code. Super User status cannot be granted or removed from the Team screen; change the system allow-list in source to update it. Workspaces remain independently stored and accessed at their respective Site URLs; this role does not create a combined cross-workspace dashboard. Deploy the updated code to each existing Site where Super User access is required. New workspaces running the same code will recognize the configured identity automatically.

## Decisions and MVP limits

- All workspace records live in a versioned D1 JSON document. Compare-and-swap updates prevent lost writes and return conflicts for refresh/retry. This is suitable for a small team; a larger fleet should move to normalized tables and paginated reads.
- Fees use manually entered road distance; there is no route-distance API or GPS tracking. Payment recording does not process payments.
- OCR runs locally; images are not uploaded or retained. First use requires Internet access to download Tesseract.js, its worker/WASM and English language data from CDNs. Printed, clear JPG/PNG images work best. Review every extracted field. Live camera/OCR and visual browser QA could not be verified in the authoring environment because computer-control permissions were unavailable.
- Refresh retrieves changes from other users; writes also detect stale revisions. No push notifications, offline writes or background synchronization.
- Shifts are single-day, in Europe/Dublin local time. Overnight shifts/availability should be split into separate days. Matching locations are case-insensitive exact names.
- Workspace roles are Super User, Admin and Driver. Existing Manager records remain compatible as Admins. Automatic invitations, payment gateways and automated route optimization are outside this MVP.
- CSV exports contain delivery/contact information and should be shared appropriately. No raw OCR images are stored.

## Source

`app/dashboard.tsx` contains the responsive UI, `app/api/workspace/route.ts` the authenticated API, `lib/domain.mjs` the validated domain operations and extraction logic, and `db/schema.ts` / `drizzle/` the persistent schema and migration. `.openai/hosting.json` retains the Site identity and D1 binding. Deployment uses the Sites source/build workflow.
