# Style QA

AGENTS.md owns the testing tier and final command gates. Select only the checks affected by the change; report actual evidence and any unverified behavior. Skill-package edits require metadata/reference validation, not application builds.

## 2) UI Implementation Gates (When Styling App Code)

When this skill is used to modify application UI:

```powershell
pnpm check
```

For larger/shared component surface changes:

```powershell
pnpm build
```

## 3) Visual Consistency Checklist

- Page shell uses dashboard border/surface recipe from offerings.
- New controls use shared component classes (`input-*`, `textarea-*`, `toggle-*`, `radio-*`, `button-*`).
- New dropdowns use `ListboxDropdown`; no new native select patterns.
- New helper popovers use `InfoPopover`.
- New action hover hints use `HoverTooltip`; no native `title` for new work.
- New transient success/error feedback uses the shared toast system instead of banners.
- Wizard modals use shared wizard primitives and footer behavior.
- Destructive flows include impact copy + typed confirmation + disabled destructive CTA until valid.
- No new `window.confirm`/native confirm usage for destructive confirmations.
- Delete/remove/leave/archive confirmations use a custom confirmation modal.
- Flat/square default is maintained except documented hybrid exceptions.

## 4) Responsive/Interaction Checklist

- Mobile (`~320-430px`) layout has no unintended horizontal overflow.
- iPad (`~768`, `~1024`) keeps action bars and controls reachable.
- Touch interactions work without hover dependency.
- Keyboard flow is preserved:
  - Focus visible on interactive controls.
  - Escape behavior is correct in popovers/modals.

## 5) Trigger-Quality Scenarios

These should be treated as positive triggers for this skill:

1. "Build a new dashboard page section with filters and action buttons."
2. "Add a wizard step with slug field and helper info."
3. "Replace a select with a consistent dashboard dropdown."

Companion skill routing expectations:

- Wizard-heavy task -> include `$playims-wizard-builder`.
- Dropdown task -> include `$playims-listbox-dropdown-builder`.
- Info helper task -> include `$playims-info-popover-builder`.
- Hover hint task -> include `$playims-hover-tooltip-builder`.
