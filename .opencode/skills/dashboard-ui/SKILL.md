---
name: dashboard-ui
description: Layout, components and polish checklist for Kulak's single-page dashboard (AG Grid tables, approval inbox, audit timeline, demo controls). Use when building or changing app/page.tsx and its components.
---

# Dashboard UI

Judges score Design as "a complete, coherent product experience". Spend real effort here, but only after the backend works.

## Page (app/page.tsx, one page, no login)
1. **Header:** "Kulak" wordmark, mode badge (AUTO / MANUAL), a "PayPal Sandbox" chip.
2. **KPI row:** Spent this week vs weekly budget (progress bar) · Open POs · Items below reorder point · Paid this week.
3. **Mandate panel:** mode toggle, weekly budget, auto-approve cap, hard cap, max qty multiple, max price spike %. Saves with PATCH /api/mandate. Explain each field in one short line.
4. **Inventory grid (AG Grid):** SKU, name, stock, reorder point, days left (colour-coded), status chip (OK / Low / Critical).
5. **Purchase orders grid (AG Grid):** created, supplier, total, status chip, guard decision, created by. Row click opens a side drawer with lines, rationale, every guard reason, payout batch id, and action buttons.
6. **Approval inbox:** cards for `pending_approval` POs: supplier, total, rationale, reasons in plain words, Approve / Reject. Reject opens a short optional note (max 280 chars) that is stored on the `po_rejected` event and shown in the audit trail and the drawer.
7. **Audit timeline:** newest first. Icon + colour per actor (agent, guard, human, paypal, system), short text, relative time.
8. **Agent trace:** full-width panel at the bottom of the page, after the audit row. Collapsible: each tool call with a one-line summary, then the agent's final summary. Fixed 340 px height with internal scroll (auto-scrolls to the newest step while running, returns to the summary when the run ends), so a streaming run never pushes other cards around.
9. **Action bar:** Run agent · Simulate sales (with an item selector, random by default) · Simulate rogue agent · Reset demo. Confirm before Reset.
10. **Mandate what-if:** sliders that re-run the real `lib/guard.ts` in the browser on a real PO (saved vs draft caps side by side). Saves nothing, moves no money.
11. **Cash-out forecast strip:** money waiting in the inbox, projected week spend vs budget, next item to run out.
12. **New order (owner override):** item + supplier + qty for a purchase the agent did not suggest. `POST /api/pos` prices it from `supplier_quotes` and sends it through the same guard and executor; a human order counts as the approval, so in manual mode an approved order pays without a second click, anything over the auto-approve cap waits in the inbox, and deny still denies.

## Behaviour
- The agent trace is streamed from `POST /api/agent/stream` (SSE): `round`, `tool`, `done`, `error` events, typed in `lib/agent.types.ts` and parsed in `components/api.ts`. `POST /api/agent/run` stays as the non-streaming API.
- Load via GET /api/state. Poll every 3 s while any PO is `paying`, otherwise every 15 s.
- Per-button loading state. Disable while running. Show errors in a toast with the server message.
- Empty states and a first-load skeleton. No raw JSON in the UI.
- "Sync" button on `paying` POs calls POST /api/pos/:id/sync.
- "Mark delivered" on `paid` POs.

## AG Grid
Check the installed `ag-grid-community` / `ag-grid-react` version and read its docs or types. Recent versions require registering modules (e.g. `ModuleRegistry.registerModules([AllCommunityModule])`) and use the Theming API instead of the old CSS imports. Do not copy setup code from memory. Master/detail is an Enterprise feature, so use the drawer instead. Grids must have an explicit height: on wide screens the grid wrapper is `xl:flex-1` with an `xl:min-h` so both table cards stretch to the sidebar height (inventory + purchase orders bottoms line up with the approval inbox); below xl they stay at a fixed 320 px.

## Visual direction
Clean light theme, generous spacing, one accent colour, tabular numbers for money, consistent status-chip colours (paid green, paying blue, pending amber, denied/failed red, delivered grey). System font stack is fine. English copy. Desktop first (1280 px), nothing broken at 1024 px.

## Polish checklist (T8)
Favicon and page title · no console errors · every button has loading + error state · numbers formatted as USD · rationale text wraps properly · drawer closes on Esc · the demo script runs without touching the console.
