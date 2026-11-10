# Kulak — demo video script (2:55, English)

Target 2:55, hard cap 3:00. Every beat is timed at ~150 wpm with slack, so the voice-over can
follow the screen capture beat by beat. Numbers are from the seeded café and may vary by a few
dollars between runs — never read a number you cannot see on screen.

Layout notes for this take: the **Agent trace is the last card on the page** (full width), so
the recording scrolls down once after clicking Run agent, then back up to the tables. The
approval inbox sits under Demo controls and ends level with the Purchase orders card.

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
| 0:41 | Demo controls | click **Run agent** | button spinner; the trace starts immediately below the fold |
| 0:43 | anywhere | scroll to the **bottom** of the page | full-width Agent trace card with `round 1` and the first tool calls |
| 0:47 | Agent trace | none | `get_mandate`, `get_inventory`, `get_open_purchase_orders`, quotes, then `create_purchase_order` ×3 |
| 0:58 | Agent trace | none | run ends: spinner gone, **Final summary** at the top of the panel |
| 1:02 | page | scroll back up to the tables | 3 purchase orders, two of them `paying` or `paid` |
| 1:07 | PO grid | none | the webhook lands: `paying` → `paid` without a reload |
| 1:12 | PO grid | click a `paid` row (a `paying` one is fine) | drawer: batch id, lines, quote comparison |
| 1:24 | Drawer | press **Esc** | drawer closes |
| 1:25 | Approval inbox | click **Details** on the ~$217 order | drawer with the guard reasons |
| 1:44 | Drawer | point at the two reason cards | `TOTAL_OVER_AUTO_CAP`, `PRICE_SPIKE` |
| 1:46 | Drawer | click **Approve & pay** | `paying`; `paid` when the webhook lands |
| 1:53 | Demo controls | click **Simulate rogue agent** | toast "Guard denied…", new `denied` PO |
| 2:01 | PO grid | click the `denied` row | reasons: unapproved supplier, quantity |
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

**[0:26 · 15 s · 36 words — hover the mandate panel]**
> The owner's rules: six hundred a week, two hundred auto-approve, six hundred hard block,
> two and a half times normal quantity, and no spike over twenty percent. The agent can read
> these; it cannot change them.

**[0:41 · 6 s · 13 words — click Run agent, start scrolling]**
> One click. The steps stream at the bottom, so let's follow it down.

**[0:47 · 15 s · 30 words — the trace panel, streaming]**
> It reads the mandate, inventory and open orders, pulls supplier quotes, drafts three orders
> and submits them — ten tool calls, four rounds, fifteen seconds — then a written summary.

**[1:02 · 10 s · 22 words — scroll up; three orders]**
> Milk and packaging fit the mandate, so they were auto-approved and paid through PayPal
> Payouts. Paying turns to paid on PayPal's webhook.

**[1:12 · 13 s · 30 words — open a paid order]**
> Every order keeps its own audit: the PayPal batch id, the lines, and how each price
> compares with the cheapest approved supplier. Totals come from supplier quotes, not the
> model.

**[1:25 · 19 s · 45 words — approval inbox, bean order]**
> The bean order is different. Two hundred seventeen dollars, above the two hundred dollar
> cap, and the price is almost twenty-one percent higher than we last paid. The guard
> escalates it. The cheaper unapproved supplier is on the list; the agent did not use it.

**[1:44 · 9 s · 20 words — reasons on screen, then Approve & pay]**
> The owner sees exactly which rules fired, in plain words, and decides. Approved — the same
> idempotent payout path runs.

**[1:53 · 19 s · 33 words — simulate rogue agent]**
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

## 3. If something goes wrong

| Problem | Recovery without breaking the take |
|---|---|
| Agent trace not on screen | It is the **last card on the page** — scroll to the bottom, it is always there. |
| Payout still `paying` at 1:12 | The batch id is already in the drawer — open it anyway. If it is still paying, click **Sync with PayPal** and say "and there is a polling fallback". |
| Payment failed / webhook missing | Keep going: the audit trail still shows the attempt. Do not re-record mid-sentence. |
| Agent takes longer than 30 s | Keep talking about the trace; it streams and auto-scrolls, so something is always moving. |
| Only two orders appear | Fine — say "the orders it could justify", never a number that is not on screen. |
| Wrong mode (manual) | Stop, Reset, set **auto**, restart from 0:00. A manual run lands everything in the inbox and breaks 1:02. |
| Anything worse | Stop, Reset demo, set auto, second take. Two clean takes beat one patched take. |

## 4. Recording workflow that fits a late night

1. **Screen capture first, no voice.** One continuous take from 0:00 to 2:55, mouse slow,
   no dead clicks — two scrolls only (down at 0:43, back up at 1:02). This avoids "uhm" while
   the agent runs.
2. Watch it once, note the real timestamps of each beat, adjust the transcript wording for
   what is actually on screen.
3. **Record voice separately** while playing the capture, segment by segment. Cut at
   sentence boundaries; no need to match lip movement.
4. Mix at −16 LUFS, fade out at the end, export 1080p MP4.
5. Upload unlisted to YouTube, put the link in the submission, keep the file locally too.

## 5. If you only get 60 seconds

Drop the forecast strip, the paid-order drawer, the audit scroll, and the mandate what-if.
Keep: 0:00 problem, 0:14 mandate, 0:20 Run agent, 0:23 trace at the bottom, 0:40 paying →
paid, 0:50 rogue denied, 0:58 close.
