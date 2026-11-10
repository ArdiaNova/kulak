# T7 — Dashboard

Read AGENTS.md, PRD.md and load the skill `dashboard-ui`. Do only this task, then stop. If it is too large for one session, build the first half (header, KPIs, mandate, inventory grid, PO grid) and tell me what remains.

1. Build `app/page.tsx` and components under `components/` as described in the skill, using `GET /api/state` and the existing API routes. Do not change backend behaviour.
2. AG Grid for inventory and purchase orders. Check the installed AG Grid version's docs for setup (module registration, theming). Say what you verified.
3. Approval inbox, audit timeline, agent trace panel, PO side drawer, action bar with loading and error states, polling as described.
4. Use the project's Tailwind setup. Clean light theme, consistent status-chip colours.

Acceptance: typecheck and build pass; `npm run dev` shows the page with seeded data; the whole PRD demo script can be clicked through. Tell me what to open and which buttons to click to test each part. Append one line to PROGRESS.md.
