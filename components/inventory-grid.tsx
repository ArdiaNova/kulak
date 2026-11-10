"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { DEFAULT_COL_DEF, GRID_MODULES, GRID_OPTIONS, GRID_THEME } from "@/components/grid-config";
import { num, stockStatus, type StateItem } from "@/components/types";
import { Card, Chip, Empty } from "@/components/ui";

function StatusCell({ data }: ICellRendererParams<StateItem>) {
  if (!data) return null;
  const status = stockStatus(data);
  return <Chip tone={status}>{status}</Chip>;
}

function DaysLeftCell({ value }: ICellRendererParams<StateItem, number>) {
  if (value === null || value === undefined) return null;
  const tone = value <= 1.5 ? "text-red-600" : value <= 3 ? "text-amber-600" : "text-neutral-600";
  return <span className={`tabular-nums ${tone}`}>{num(value)} days</span>;
}

const COLUMNS: ColDef<StateItem>[] = [
  { field: "sku", headerName: "SKU", width: 130, cellClass: "font-mono text-xs" },
  { field: "name", headerName: "Item", flex: 2, minWidth: 180 },
  {
    headerName: "Stock",
    width: 120,
    valueGetter: ({ data }) => (data ? data.stock : null),
    cellRenderer: ({ data }: ICellRendererParams<StateItem>) =>
      data ? (
        <span className="tabular-nums">
          {num(data.stock)} <span className="text-neutral-400">{data.unit}</span>
        </span>
      ) : null,
  },
  {
    field: "reorderPoint",
    headerName: "Reorder at",
    width: 120,
    valueFormatter: ({ value }) => num(Number(value ?? 0)),
    cellClass: "tabular-nums text-neutral-600",
  },
  { field: "daysLeft", headerName: "Days left", width: 130, cellRenderer: DaysLeftCell },
  {
    headerName: "Status",
    width: 120,
    valueGetter: ({ data }) => (data ? stockStatus(data) : null),
    cellRenderer: StatusCell,
  },
];

export function InventoryGrid({ items }: { items: StateItem[] }) {
  const low = items.filter((item) => item.stock <= item.reorderPoint).length;

  return (
    <Card
      title="Inventory"
      action={
        <span className="text-xs text-neutral-500">
          {items.length} items · {low} below reorder point
        </span>
      }
    >
      {items.length === 0 ? (
        <Empty>No items yet. Run the simulator reset to seed the café.</Empty>
      ) : (
        <div className="h-[320px] w-full p-1">
          <AgGridReact<StateItem>
            theme={GRID_THEME}
            modules={GRID_MODULES}
            rowData={items}
            columnDefs={COLUMNS}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.id}
            {...GRID_OPTIONS}
          />
        </div>
      )}
    </Card>
  );
}
