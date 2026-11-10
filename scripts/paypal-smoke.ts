/**
 * Manual PayPal sandbox smoke test. Sends ONE $1.00 payout, then polls.
 *
 *   node --env-file=.env.local --import tsx scripts/paypal-smoke.ts --dry-run
 *   node --env-file=.env.local --import tsx scripts/paypal-smoke.ts
 *
 * --dry-run validates env and prints the plan without calling PayPal.
 */
import { createPayout, getPayoutBatch, PayPalError } from "../lib/paypal";

const AMOUNT = 1.0;
const POLL_EVERY_MS = 5_000;
const POLL_FOR_MS = 90_000;
const REQUIRED = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "SUPPLIER_PAYOUT_EMAIL"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    console.error("Fill .env.local, then run with --env-file=.env.local.");
    process.exitCode = 2;
    return;
  }

  const receiver = process.env.SUPPLIER_PAYOUT_EMAIL as string;
  // createPayout prefixes "kulak-", so this produces kulak-smoke-<timestamp>.
  const poId = `smoke-${Date.now()}`;
  const batchId = `kulak-${poId}`;

  console.log(`Sandbox:   ${process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com"}`);
  console.log(`Receiver:  ${receiver}`);
  console.log(`Amount:    $${AMOUNT.toFixed(2)} USD`);
  console.log(`Batch id:  ${batchId}`);

  if (dryRun) {
    console.log("DRY RUN — no money sent, no PayPal call made.");
    return;
  }

  const created = await createPayout({
    poId,
    amount: AMOUNT,
    receiver,
    note: "Kulak smoke test",
  });
  console.log(`\nCreated batch ${created.batchId} (status ${created.status})`);

  const deadline = Date.now() + POLL_FOR_MS;
  let last: Awaited<ReturnType<typeof getPayoutBatch>> | null = null;

  while (Date.now() < deadline) {
    await sleep(POLL_EVERY_MS);

    const batch = await getPayoutBatch(created.batchId);
    last = batch;
    const items = batch.items
      .map((item) => `${item.status}${item.senderItemId ? ` (${item.senderItemId})` : ""}`)
      .join(", ");
    console.log(
      `[${new Date().toISOString()}] batch ${batch.status}${items ? ` · items: ${items}` : ""}`,
    );

    if (batch.status !== "PENDING" && batch.status !== "PROCESSING") break;
  }

  if (!last) {
    console.log(`\nStill PENDING after ${POLL_FOR_MS / 1000} s. Check the PayPal dashboard.`);
    return;
  }

  // A SUCCESS batch can still carry a non-final item status. That is the case
  // that matters: the demo needs PAYMENT.PAYOUTS-ITEM.SUCCEEDED -> paid.
  const statuses = last.items.map((item) => item.status);
  const problems = last.items.flatMap((item) =>
    item.errors.map((error) => `${error.name}: ${error.message}`),
  );
  if (problems.length > 0) {
    console.error("\nPayPal says:");
    for (const problem of problems) console.error(`  - ${problem}`);
    if (problems.some((problem) => problem.startsWith("SELF_PAY_NOT_ALLOWED"))) {
      console.error(
        "\nThe receiver email is the SAME account as your Client ID. Use a different sandbox account:",
      );
      console.error(
        "developer.paypal.com -> Sandbox -> Accounts -> a Personal account -> copy its email.",
      );
    }
  }

  if (statuses.length > 0 && statuses.every((status) => status === "SUCCESS")) {
    console.log("\nGood: batch and item are SUCCESS. Use this receiver email for the demo.");
    return;
  }

  if (statuses.includes("UNCLAIMED")) {
    console.error(
      "\nWARNING: item status UNCLAIMED. The receiver email is not a confirmed PayPal sandbox account,",
    );
    console.error(
      "so the money cannot be claimed and the demo PO would end as payment_failed.",
    );
    console.error(
      "Fix: developer.paypal.com -> Sandbox -> Accounts -> copy a Personal account email -> SUPPLIER_PAYOUT_EMAIL.",
    );
    process.exitCode = 3;
    return;
  }

  console.log(`\nBatch ${last.status}; item statuses: ${statuses.join(", ") || "-"}.`);
}

main().catch((error: unknown) => {
  if (error instanceof PayPalError) {
    console.error(
      `\nPayPalError ${error.name} (status ${error.status}, debug_id ${error.debugId ?? "-"}): ${error.message}`,
    );
  } else {
    console.error("\nFailed:", error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
