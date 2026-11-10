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
6. **Approval inbox:** cards for `pending_approval` POs: supplier, total, rationale, reasons in plain words, Approve / Reject.
7. **Audit timeline:** newest first. Icon + colour per actor (agent, guard, human, paypal, system), short text, relative time.
8. **Agent trace:** collapsible panel after "Run agent": each tool call with a one-line summary, then the agent's final summary.
9. **Action bar:** Run agent · Simulate sales · Simulate rogue agent · Reset demo. Confirm before Reset.

## Behaviour
- Load via GET /api/state. Poll every 3 s while any PO is `paying`, otherwise every 15 s.
- Per-button loading state. Disable while running. Show errors in a toast with the server message.
- Empty states and a first-load skeleton. No raw JSON in the UI.
- "Sync" button on `paying` POs calls POST /api/pos/:id/sync.
- "Mark delivered" on `paid` POs.

## AG Grid
Check the installed `ag-grid-community` / `ag-grid-react` version and read its docs or types. Recent versions require registering modules (e.g. `ModuleRegistry.registerModules([AllCommunityModule])`) and use the Theming API instead of the old CSS imports. Do not copy setup code from memory. Master/detail is an Enterprise feature, so use the drawer instead. Grids must have an explicit height.

## Visual direction
Clean light theme, generous spacing, one accent colour, tabular numbers for money, consistent status-chip colours (paid green, paying blue, pending amber, denied/failed red, delivered grey). System font stack is fine. English copy. Desktop first (1280 px), nothing broken at 1024 px.

## Polish checklist (T8)
Favicon and page title · no console errors · every button has loading + error state · numbers formatted as USD · rationale text wraps properly · drawer closes on Esc · the demo script runs without touching the console.
