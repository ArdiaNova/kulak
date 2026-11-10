"use client";

import { useState } from "react";

import { Button } from "@/components/ui";

/**
 * A short note before rejecting an order. Optional on purpose: the owner may
 * just want it gone, and a forced field would slow the demo down. Whatever is
 * typed is stored on the `po_rejected` event and shown in the audit trail.
 */
export function RejectNote({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="w-full space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-2">
      <textarea
        autoFocus
        rows={2}
        maxLength={280}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why reject? Optional — it is saved in the audit trail."
        className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tabular-nums text-neutral-400">{reason.length}/280</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" busy={busy} onClick={() => onConfirm(reason.trim())}>
            Confirm reject
          </Button>
        </div>
      </div>
    </div>
  );
}
