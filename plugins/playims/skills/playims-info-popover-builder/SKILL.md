---
name: playims-info-popover-builder
description: Add or migrate persistent explanatory help with PlayIMs InfoPopover, shared floating placement, and accessible label-row triggers. Use HoverTooltip for short action hints.
---

# PlayIMs Info Popover Builder

Reuse InfoPopover for supplemental help that persists after a click.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `src/lib/components/InfoPopover.svelte` and the active consumer; inspect shared floating-position.ts for placement changes.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Keep decision-critical instructions inline. Supplemental helper text belongs in short paragraphs; avoid repeating the same explanation beside the control.
- Use a context-specific buttonAriaLabel and existing default classes. Form-label helpers use buttonVariant="label-inline" and the shared min-h-6 label row.
- Preserve click toggle, outside-pointer close, aria-expanded/haspopup, mounted-only-while-open panels, and fixed viewport clamping.
- Escape must close the popover before its parent modal via the existing capture/propagation handling. Positioning remains shared with HoverTooltip.
- Keep popovers explanatory; they are not focus-managed menus/dialogs for interactive controls. Slug revert and similar field actions use HoverTooltip around the action instead.
- Override width/alignment only for concrete layout constraints; do not create new helper panel systems.

## Read detail when needed

- [integration contract](references/integration-contract.md): Prop defaults and label-inline/paragraph recipes.
- [qa matrix](references/qa-matrix.md): Escape, outside click, labels, and viewport checks.

## Done when

The help stays supplemental and closes correctly by toggle, outside pointer, and Escape without closing the parent modal; verify changed placement and labels. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
