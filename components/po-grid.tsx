"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { DEFAULT_COL_DEF, GRID_MODULES, GRID_OPTIONS, GRID_THEME } from "@/components/grid-config";
import { money, relativeTime, shortId, type StatePO } from "@/components/types";
import { Card, Chip, statusLabel } from "@/components/ui";

const DECISION_TONE: Record<string, string> = {
  approve: "ok",
  escalate: "low",
  deny: "critical",
};

function StatusCell({ data }: ICellRendererParams<StatePO>) {
  if (!data) return null;
  return <Chip tone={data.status}>{statusLabel(data.status)}</Chip>;
}

function DecisionCell({ data }: ICellRendererParams<StatePO>) {
  if (!data) return null;
  if (!data.guardDecision) return <span className="text-neutral-400">—</span>;
  return <Chip tone={DECISION_TONE[data.guardDecision] ?? "low"}>{data.guardDecision}</Chip>;
}

export function POGrid({
  pos,
  supplierNames,
  onSelect,
}: {
  pos: StatePO[];
  supplierNames: Record<string, string>;
  onSelect: (id: string) => void;
}) {
  const columns: ColDef<StatePO>[] = [
    {
      field: "createdAt",
      headerName: "Created",
      width: 110,
      valueFormatter: ({ value }) => relativeTime(String(value), Date.now()),
      cellClass: "text-neutral-600",
    },
    {
      headerName: "Supplier",
      flex: 1,
      minWidth: 150,
      valueGetter: ({ data }) => (data ? (supplierNames[data.supplierId] ?? data.supplierId) : ""),
    },
    {
      field: "total",
      headerName: "Total",
      width: 110,
      valueFormatter: ({ value }) => money(Number(value ?? 0)),
      cellClass: "tabular-nums font-medium",
    },
    { headerName: "Status", width: 120, valueGetter: ({ data }) => data?.status, cellRenderer: StatusCell },
    {
      headerName: "Guard",
      width: 110,
      valueGetter: ({ data }) => data?.guardDecision,
      cellRenderer: DecisionCell,
    },
    {
      field: "createdBy",
      headerName: "By",
      width: 90,
      cellClass: "text-neutral-600 capitalize",
    },
    {
      headerName: "Payout",
      width: 130,
      valueGetter: ({ data }) => shortId(data?.payoutBatchId),
      cellClass: "font-mono text-xs text-neutral-500",
    },
  ];

  return (
    <Card
      title="Purchase orders"
      hint="What the agent drafted, what the guard decided, and what PayPal did with it."
      action={<span className="text-xs text-neutral-500">Click a row for details</span>}
      className="flex flex-col xl:min-h-0 xl:flex-1"
    >
      {pos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-neutral-500">
          No purchase orders yet. Run the agent to draft the first one.
        </div>
      ) : (
        <div className="h-[320px] w-full p-1 xl:h-auto xl:min-h-[260px] xl:flex-1">
          <AgGridReact<StatePO>
            theme={GRID_THEME}
            modules={GRID_MODULES}
            rowData={pos}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.id}
            onRowClicked={({ data }) => data && onSelect(data.id)}
            rowClass="cursor-pointer"
            {...GRID_OPTIONS}
          />
        </div>
      )}
    </Card>
  );
}
