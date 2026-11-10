# Kulak — demo video script (2:55, English)

Target 2:55, hard cap 3:00. Every beat is timed at ~150 wpm with slack, so the voice-over can
follow the screen capture beat by beat. Numbers are from the seeded café and may vary by a few
dollars between runs — never read a number you cannot see on screen.

Layout notes: the **Agent trace is the last card on the page** (full width), so the recording
scrolls down once after clicking Run agent, then back up to the tables. The sidebar is Demo
controls → **New order** → Approval inbox (inbox ends level with the Purchase orders card).
The payout usually stays on `paying` for 10–30 s; **that waiting time is where the New order
card gets its one sentence**, so the total length does not change.

## 0. Pre-flight (do this 10 minutes before recording)

| Where | Step |
|---|---|
| Browser, `kulak.vercel.app` | **Reset demo** → **OK**. DB back to seeded stock, 0 orders, mode `manual`. |
| Browser, Mandate panel | Click **auto**. Header chip must read `Auto Mode`. This is required, otherwise nothing gets paid by itself. |
| Browser | Confirm KPI "Items below reorder point" = **5** and the forecast strip shows **$0.00 waiting**. |
| Browser | Scroll to the bottom once to confirm the **Agent trace** card is there, then scroll back to the top. |
| Browser | Window ≈ 1500×950, zoom 100%, bookmarks bar hidden, one tab only. |
| Browser | DevTools closed. Extensions off. |
| OS | Do Not Disturb on, notifications off, Slack/WhatsApp closed. |
| Mic | Record a 10 s test, listen back. Peak around −12 dB, no clipping. |
| Screen | 1080p, 30 fps, record the **browser window** (not the whole desktop). |

Rehearse once end to end, then **Reset demo** again and set **auto** again before the real take.

## 1. Shot list

| Time | On screen | Action | Expected result |
|---|---|---|---|
| 0:00 | Dashboard, top of page | none, cursor still | 5 low items, chip `Auto Mode` |
| 0:15 | KPI row + forecast strip | point with cursor, no clicks | 5 below reorder, $0.00 waiting |
| 0:26 | Mandate panel | hover the five numbers | 600 / 200 / 600 / 2.5 / 20 |
| 0:41 | Demo controls | click **Run agent** | button spinner; the trace starts below the fold |
| 0:43 | anywhere | scroll to the **bottom** of the page | full-width Agent trace card, `round 1`, first tool calls |
| 0:47 | Agent trace | none | `get_mandate`, `get_inventory`, `get_open_purchase_orders`, quotes, `create_purchase_order` ×3 |
| 0:57 | Agent trace | none | run ends: spinner gone, **Final summary** at the top of the panel |
| 1:01 | page | scroll back up to the tables | 3 purchase orders; two are `paying` or already `paid` |
| 1:05 | PO grid | none | if still `paying`, say so — the webhook will flip it |
| 1:08 | New order card (sidebar) | point at it, no clicks | shows item / supplier / qty + Place order |
| 1:15 | PO grid | click a `paid` row (a `paying` one is fine) | drawer: batch id, lines, quote comparison |
| 1:27 | Drawer | press **Esc** | drawer closes |
| 1:28 | Approval inbox | click **Details** on the ~$217 order | drawer with the guard reasons |
| 1:46 | Drawer | point at the two reason cards | `TOTAL_OVER_AUTO_CAP`, `PRICE_SPIKE` |
| 1:47 | Drawer | click **Approve & pay** | `paying`; `paid` when the webhook lands |
| 1:54 | Demo controls | click **Simulate rogue agent** | toast "Guard denied…", new `denied` PO |
| 2:02 | PO grid | click the `denied` row | reasons: unapproved supplier, quantity |
| 2:12 | Drawer → PO grid | **Esc**, then a `paid` row → **Mark delivered** | stock refills |
| 2:20 | Inventory grid | point at the refilled item | stock number went up |
| 2:22 | Audit timeline | slow scroll | A / G / H / P / S entries |
| 2:32 | Mandate what-if | pick the FreshDairy order (~$92), drag **Auto-approve cap** to $50 | saved side `approve`, draft side flips to `escalate` |
| 2:42 | Dashboard, full frame | none | hold, end card |

## 2. Transcript

Speak at a normal pace (~150 wpm). Word counts per beat are inside the brackets.

**[0:00 · 14 s · 36 words — dashboard, nothing clicked]**
> Small cafés lose sales when stock runs out, but letting software touch money is scary.
> Kulak is an AI purchasing agent that can buy — inside a spending mandate enforced in code,
> not by the model.

**[0:15 · 11 s · 26 words — point at the KPI row and forecast strip]**
> This is a real café. Five items are below reorder, three run out in under two days, and
> this strip shows what is waiting for approval.

**[0:26 · 14 s · 36 words — hover the mandate panel]**
> The owner's rules: six hundred a week, two hundred auto-approve, six hundred hard block,
> two and a half times normal quantity, and no spike over twenty percent. The agent can read
> these; it cannot change them.

**[0:41 · 6 s · 13 words — click Run agent, start scrolling]**
> One click. The steps stream at the bottom, so let's follow it down.

**[0:47 · 14 s · 30 words — the trace panel, streaming]**
> It reads the mandate, inventory and open orders, pulls supplier quotes, drafts three orders
> and submits them — ten tool calls, four rounds, fifteen seconds — then a written summary.

**[1:01 · 14 s · 34 words — tables; payout in flight; point at New order]**
> Milk and packaging fit the mandate, so they were paid through PayPal Payouts; paying turns
> to paid on the webhook. While that lands, the owner can also order by hand. Same guard,
> same payout.

**[1:15 · 12 s · 29 words — open a paid order]**
> Every order keeps its own audit: the PayPal batch id, the lines, and how each price
> compares with the cheapest approved supplier. Totals come from quotes, not the model.

**[1:27 · 19 s · 45 words — approval inbox, bean order]**
> The bean order is different. Two hundred seventeen dollars, above the two hundred dollar
> cap, and the price is almost twenty-one percent higher than we last paid. The guard
> escalates it. The cheaper unapproved supplier is on the list; the agent did not use it.

**[1:46 · 8 s · 17 words — reasons on screen, then Approve & pay]**
> The owner sees exactly which rules fired and decides. Approved — the same idempotent payout
> path runs.

**[1:54 · 18 s · 33 words — simulate rogue agent]**
> Now the hostile case: a compromised agent, an unapproved supplier, an oversized quantity.
> The guard denies it. No approve button, no payout, PayPal never called. The model never
> gets a vote on money.

**[2:12 · 10 s · 15 words — mark delivered]**
> When the delivery arrives, one click records it, stock refills, and the loop is closed.

**[2:22 · 10 s · 17 words — audit timeline]**
> Every actor is on the record — agent, guard, human, PayPal, system. Nothing happens off
> the books.

**[2:32 · 10 s · 24 words — what-if sliders]**
> The guard is pure code, so the browser runs the same function. Lower the cap to fifty
> dollars and the verdict flips to escalate.

**[2:42 · 13 s · 31 words — full dashboard, end card]**
> Kulak is built for a café owner with one to five outlets. The AI decides what to buy and
> from whom. Plain code decides whether money may move. PayPal moves it.

## 3. Facts to keep straight (not spoken)

Use these if a judge asks during or after the demo.

- Mandate (seeded): $600/week, $200 auto-approve cap, $600 hard block, 2.5× normal quantity,
  20% price spike. Nine rules in `lib/guard.ts`, pure code, no clock and no LLM.
- The agent has six tools: get_mandate, get_inventory, get_open_purchase_orders,
  get_supplier_quotes, create_purchase_order, submit_purchase_order. It never sees PayPal
  credentials and cannot call PayPal.
- PayPal: sandbox Payouts, `sender_batch_id = kulak-<po_id>`, `sender_item_id = <po_id>`,
  conditional `approved → paying`, signed webhook `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, plus a
  Sync button that polls the same idempotent path.
- New order (owner override): same guard and payout path, `createdBy = human`. Human order =
  approval, so inside the cap it pays at once; above the cap it waits in the inbox; hard cap
  or an odd quantity is still denied.
- Reject stores the optional note on the `po_rejected` event and shows it in the audit trail.
- Simulate sales can be aimed at one item; Simulate rogue agent always ends `denied`.
- Everything writes an `events` row: agent, guard, human, paypal, system.

## 4. If something goes wrong

| Problem | Recovery without breaking the take |
|---|---|
| Agent trace not on screen | It is the **last card on the page** — scroll to the bottom, it is always there. |
| Payout still `paying` at 1:15 | Normal. Open the drawer anyway (the batch id is there), and use the wait to point at **New order**. Click **Sync with PayPal** only if it is still paying much later. |
| Payment failed / webhook missing | Keep going: the audit trail still shows the attempt. Do not re-record mid-sentence. |
| Agent takes longer than 30 s | Keep talking about the trace; it streams and auto-scrolls, so something is always moving. |
| Only two orders appear | Fine — say "the orders it could justify", never a number that is not on screen. |
| Wrong mode (manual) | Stop, Reset, set **auto**, restart from 0:00. A manual run lands everything in the inbox and breaks 1:01. |
| Anything worse | Stop, Reset demo, set auto, second take. Two clean takes beat one patched take. |

## 5. Recording workflow that fits a late night

1. **Screen capture first, no voice.** One continuous take from 0:00 to 2:55, mouse slow,
   no dead clicks — two scrolls only (down at 0:42, back up at 1:01). This avoids "uhm" while
   the agent runs.
2. Watch it once, note the real timestamps of each beat, adjust the transcript wording for
   what is actually on screen.
3. **Record voice separately** while playing the capture, segment by segment. Cut at
   sentence boundaries; no need to match lip movement.
4. Mix at −16 LUFS, fade out at the end, export 1080p MP4.
5. Upload unlisted to YouTube, put the link in the submission, keep the file locally too.

## 6. If you only get 60 seconds

Drop the forecast strip, the paid-order drawer, the audit scroll, the New order line, and the
mandate what-if. Keep: 0:00 problem, 0:14 mandate, 0:20 Run agent, 0:23 trace at the bottom,
0:40 paying → paid, 0:50 rogue denied, 0:58 close.
