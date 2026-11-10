# T5 — Purchasing agent

Read AGENTS.md, PRD.md and load the skill `purchasing-agent`. Do only this task, then stop.

1. `lib/prompts.ts`: export the system prompt, copied verbatim from `prompts/purchasing-agent.system.md`.
2. `lib/agent.ts`: the tool loop exactly as described in the skill: six tools, Zod validation of arguments, errors returned to the model as tool results, 10-iteration limit, every call recorded in `events` and in the returned `trace`. Check the installed `openai` package types for the exact parameter names and say what you verified.
3. `app/api/agent/run/route.ts`: POST runs the agent and returns `{ trace, summary, purchaseOrders }`. Set the route's max duration to the largest value allowed on a Vercel Hobby plan (check the current Next.js and Vercel docs, do not guess).
4. Tests with a fake model: argument validation, iteration limit, and "agent tries to submit a PO for the unapproved supplier → status denied, no PayPal call".

Acceptance: typecheck, tests, build pass. Then give me a curl command to run the agent against my real LLM endpoint, and say which env vars it needs. Append one line to PROGRESS.md.
