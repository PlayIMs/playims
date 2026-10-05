---
name: playims-hover-tooltip-builder
description: Add or migrate short hover/focus hints with PlayIMs HoverTooltip, preserving cursor tracking, body portals, and viewport safety. Use InfoPopover for persistent explanatory help.
---

# PlayIMs Hover Tooltip Builder

Use HoverTooltip for supplemental action hints with shared floating behavior.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `src/lib/components/HoverTooltip.svelte` and one active consumer; inspect floating-position.ts when placement changes.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Wrap the actionable element directly and preserve its handlers, classes, and accessible label. Tooltip text is supplemental; required instructions stay visible.
- Keep copy concise and action-specific. Use shortcutKeys for real documented shortcuts; use wrapperClass for fill/block layouts rather than changing action semantics.
- Preserve hover/focus opening, cursor-follow placement, viewport flipping/clamping, and readable width.
- Panels remain fixed, portaled to document.body, above modal/stacking contexts, and pointer-events-none. Do not add route-local positioning or native title hints.
- Use DateHoverText for displayed dates/times and InfoPopover for paragraph-heavy or click-persistent help.

## Read detail when needed

- [integration contract](references/integration-contract.md): Prop defaults, portal contract, and wrapper recipes.
- [qa matrix](references/qa-matrix.md): Focus, cursor, viewport edges, and modal checks.

## Done when

The affected hint works with pointer and focus, stays visible near relevant viewport edges/modals, and preserves the wrapped action. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
