"use client";

import { useState } from "react";

import { Button, Card, Chip } from "@/components/ui";
import { money } from "@/components/types";
import type { StateResponse } from "@/components/types";
import type { Mandate } from "@/lib/types";

/** The owner's rules. Every field saves through PATCH /api/mandate. */

type Draft = {
  weeklyBudget: string;
  autoApproveCap: string;
  hardBlockCap: string;
  maxQtyMultiple: string;
  maxPriceSpikePct: string;
};

const toDraft = (mandate: Mandate): Draft => ({
  weeklyBudget: String(mandate.weeklyBudget),
  autoApproveCap: String(mandate.autoApproveCap),
  hardBlockCap: String(mandate.hardBlockCap),
  maxQtyMultiple: String(mandate.maxQtyMultiple),
  maxPriceSpikePct: String(mandate.maxPriceSpikePct),
});

const FIELDS: { key: keyof Draft; label: string; hint: string; step: string }[] = [
  { key: "weeklyBudget", label: "Weekly budget", hint: "Total spend allowed per rolling week.", step: "10" },
  { key: "autoApproveCap", label: "Auto-approve cap", hint: "Orders above this wait for the owner.", step: "10" },
  { key: "hardBlockCap", label: "Hard block cap", hint: "Orders above this are denied outright.", step: "10" },
  { key: "maxQtyMultiple", label: "Max quantity", hint: "Compared to 7 days of average use.", step: "0.1" },
  { key: "maxPriceSpikePct", label: "Max price spike %", hint: "Versus the last paid unit price.", step: "1" },
];

export function MandatePanel({
  state,
  onSaved,
  onError,
}: {
  state: StateResponse;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  // Null means "show what is saved", so a poll can never clobber an edit and a
  // successful save clears the draft instead of copying values around.
  const [edited, setEdited] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const draft = edited ?? toDraft(state.mandate);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/mandate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? "Could not save the mandate.");
      }
      await onSaved();
      setEdited(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save the mandate.");
    } finally {
      setBusy(false);
    }
  }

  const dirty = FIELDS.some((field) => draft[field.key] !== String(state.mandate[field.key as keyof Mandate]));

  return (
    <Card
      title="Spending mandate"
      action={
        <div className="flex items-center gap-2">
          <Chip tone={state.mandate.mode}>{state.mandate.mode}</Chip>
          <Button
            busy={busy}
            disabled={!dirty}
            onClick={() =>
              save({
                weeklyBudget: Number(draft.weeklyBudget),
                autoApproveCap: Number(draft.autoApproveCap),
                hardBlockCap: Number(draft.hardBlockCap),
                maxQtyMultiple: Number(draft.maxQtyMultiple),
                maxPriceSpikePct: Number(draft.maxPriceSpikePct),
              })
            }
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-neutral-900">Payment mode</p>
            <p className="text-xs text-neutral-500">
              Auto pays approved orders immediately. Manual holds every order for you.
            </p>
          </div>
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
            {(["manual", "auto"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={busy}
                onClick={() => save({ mode })}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                  state.mandate.mode === mode
                    ? "bg-blue-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-neutral-700">{field.label}</span>
                <span className="text-[11px] text-neutral-400">
                  now {field.key === "maxQtyMultiple" ? "×" : "$"}
                  {state.mandate[field.key as keyof Mandate] as number}
                </span>
              </span>
              <input
                value={draft[field.key]}
                step={field.step}
                inputMode="decimal"
                onChange={(event) =>
                  setEdited({ ...draft, [field.key]: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm tabular-nums text-neutral-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <span className="mt-1 block text-[11px] text-neutral-500">{field.hint}</span>
            </label>
          ))}
        </div>

        <p className="text-[11px] text-neutral-500">
          Enforced in <code className="rounded bg-neutral-100 px-1">lib/guard.ts</code>, which
          the agent cannot see or change. Spend this week: {money(state.weekSpent)}.
        </p>
      </div>
    </Card>
  );
}
