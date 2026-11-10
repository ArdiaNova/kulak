"use client";

import { AllCommunityModule, themeQuartz, type Theme } from "ag-grid-community";

/**
 * AG Grid 36.3.0, verified from the installed types:
 * - modules are supplied per grid via the `modules` prop
 *   (ag-grid-react/dist/types/src/shared/interfaces.d.ts: `modules?: Module[]`),
 * - the Theming API replaces the old CSS imports
 *   (gridOptions.d.ts: `theme?: Theme | 'legacy'`), and `themeQuartz.withParams`
 *   is typed against the real theme params (accentColor, borderColor, …).
 */
export const GRID_MODULES = [AllCommunityModule];

export const GRID_THEME: Theme = themeQuartz.withParams({
  accentColor: "#2563eb",
  backgroundColor: "#ffffff",
  borderColor: "#e5e5e5",
  foregroundColor: "#171717",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  fontSize: 13,
  spacing: 5,
});

export const DEFAULT_COL_DEF = {
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
};

export const GRID_OPTIONS = {
  rowHeight: 38,
  headerHeight: 36,
  animateRows: true,
};
