# Dashboard Layout Recipes

## Contents

1. Page shell
2. Hero/header composition
3. Main board layout
4. Toolbar and action cluster
5. Search row
6. Content panel patterns
7. Sidebar/snapshot patterns
8. Empty/loading states
9. Responsive rules

## Page Shell

Canonical wrapper from offerings:

- `p-6 lg:p-8 space-y-6`

Use for dashboard pages with title block + content sections.

## Hero/Header Composition

Primary recipe:

- Header wrapper: `border-2 border-secondary-300 bg-neutral p-5 space-y-4`
- Top row: `flex items-start gap-4`
- Icon tile: `bg-primary text-white w-11 h-11 flex items-center justify-center`
- Page title: `text-5xl lg:text-6xl leading-[0.9] font-bold font-serif text-neutral-950`

When no icon tile is needed, keep the same heading rhythm and border shell.

## Main Board Layout

Two-column board pattern for dashboard + snapshot:

- Grid: `grid grid-cols-1 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)] gap-6`
- Primary panel shell: `min-w-0 border-2 border-secondary-300 bg-neutral`
- Panel header strip: `p-4 border-b border-secondary-300 bg-neutral-600/66`
- Panel body: `p-4 space-y-4`

Use `min-w-0` on primary content columns to prevent flex/grid overflow.

## Toolbar And Action Cluster

Section title + selectors:

- Row: `flex flex-col gap-2 md:flex-row md:items-center md:justify-between`
- Left group: `flex items-center gap-2`
- Right group: `flex items-center gap-2 text-xs text-neutral-950 font-sans`

Badge-like counters:

- `border border-secondary-300 px-2 py-1`

Split primary add button + dropdown trigger:

- Wrapper: `relative inline-flex items-stretch`
- Main CTA: `button-primary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer`
- Attached dropdown trigger: `button-primary-outlined -ml-[2px] px-1 py-1 cursor-pointer`

Compact icon-only management trigger:

- `button-secondary-outlined p-1.5 cursor-pointer`

## Search Row

Use `SearchInput` with consistent class contract:

- Wrapper: `relative`
- Icon: `absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-950`
- Input: `input-secondary pl-10 pr-10 py-1 text-sm`
- Clear button: `absolute right-2 top-1/2 -translate-y-1/2 text-neutral-950 hover:text-secondary-900 cursor-pointer`

If disabled, keep `disabled:cursor-not-allowed`.

## Content Panel Patterns

Standard content card:

- `border border-secondary-300 bg-white p-4 space-y-3`

Subsection callout:

- `border border-secondary-300 bg-white p-3 text-sm text-neutral-950 space-y-2`

Scrollable table region:

- Wrapper: `border border-secondary-300 bg-white overflow-x-auto`
- Table: `min-w-full border-collapse`

Nested helper container:

- `border border-secondary-200 bg-neutral p-2 space-y-2`

## Sidebar/Snapshot Patterns

Sidebar shell:

- `border-2 border-secondary-300 bg-neutral`

Stat card blocks:

- Neutral stats: `card-secondary-outlined`
- Positive/open state: `card-primary-outlined`

Stat label:

- `text-[11px] uppercase tracking-wide font-bold`

Stat value:

- `text-2xl font-bold font-serif`

## Empty/Loading States

No-data message block:

- `border border-secondary-300 bg-white p-4 space-y-2`

Filtered-empty warning:

- `border border-warning-300 bg-warning-50 p-3`

Skeleton cards:

- Reuse real layout borders with neutral placeholder bars (`bg-neutral-100`) so spacing stays realistic.

## Responsive Rules

- Start mobile-first (`grid-cols-1`, stacked actions).
- Expand at `md`/`lg` for horizontal toolbars and split forms.
- Keep explicit overflow containers for wide tables and dense lists.
- Preserve action accessibility on touch devices:
  - Avoid hiding critical controls behind hover-only behavior.
  - Keep compact icon buttons large enough for tapping.
