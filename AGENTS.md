# Kulak — AI purchasing agent for small cafés (PayPal AI Hackathon)

Deadline: Nov 13 2026 03:00 WIB. Scope lives in PRD.md. Before touching an area, load its skill from .opencode/skills.

## What it is
Kulak watches café stock, an LLM agent drafts purchase orders to suppliers, a spending mandate enforced in plain code decides approve / escalate / deny, and approved orders are paid to suppliers through PayPal Payouts (sandbox). A PayPal webhook closes the loop and stock refills after delivery.

## Stack (do not change without asking)
- Next.js App Router + TypeScript + Tailwind, as scaffolded. Check package.json for installed versions.
- Supabase Postgres via @supabase/supabase-js, server-side only, service-role key.
- Zod for env and for ALL LLM output / tool args / webhook input.
- `openai` npm package against any OpenAI-compatible endpoint (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY).
- ag-grid-community + ag-grid-react for tables.
- vitest for unit tests.
- PayPal SANDBOX only: https://api-m.sandbox.paypal.com

## Hard rules
1. Never commit or print secrets. Secrets live in .env.local (gitignored). Keep .env.example in sync with lib/env.ts.
2. Never run `git push`, never deploy, never create remote repos. Commit locally only when the user asks.
3. The LLM never receives PayPal credentials. It only calls our tool functions. Only server code calls PayPal, and only through lib/executor.ts after lib/guard.ts has returned a decision.
4. lib/guard.ts is pure: no I/O, no LLM, no Date.now() (time is passed in as `now`). Every rule has a unit test.
5. Every agent / guard / human / paypal / system action writes a row to `events`.
6. Money: numbers with 2 decimals in code, strings with 2 decimals in PayPal requests. Currency USD. Totals and prices are computed server-side from supplier_quotes. Never trust a price or total sent by the LLM or the browser.
7. Payout idempotency: sender_batch_id = `kulak-<po_id>`, sender_item_id = `<po_id>`. A PO moves approved → paying exactly once (conditional UPDATE ... WHERE status='approved').
8. Do not guess APIs. If unsure about a library or a PayPal field, read the installed package types in node_modules or the official docs first, then write code. Say what you verified.

## Working style
- One task per session, taken from prompts/T*.md. Do not start the next task.
- After each task run `npm run typecheck`, `npm test`, and `npm run build` where relevant. Report results honestly, including failures.
- Keep files under ~200 lines. No refactors unless asked.
- Append one line to PROGRESS.md after each task: date, task id, result.
- When the user must act outside the terminal (browser, Supabase, PayPal dashboard, Vercel), stop and write exact steps, each labelled with where it happens (terminal / browser + site name). Never assume the user knows where a button is.
- The user's machine is Linux Mint, Node 20.x, npm 10.x. Use commands that work there.
- Be terse.

## Commands
npm run dev · npm run build · npm run typecheck · npm test

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
