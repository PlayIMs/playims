# QA Gates

All gates in this file are required for changes using `playims-style-builder`.

## 1) Skill Package Integrity Gates

Run from repo root:

```powershell
python "C:\Users\jh6\.codex\skills\.system\skill-creator\scripts\quick_validate.py" ".codex/skills/playims-style-builder"
```

If `agents/openai.yaml` was changed manually, regenerate deterministically:

```powershell
python "C:\Users\jh6\.codex\skills\.system\skill-creator\scripts\generate_openai_yaml.py" ".codex/skills/playims-style-builder" --interface "display_name=PlayIMs Style Builder" --interface "short_description=Build PlayIMs UI that matches dashboard and wizard patterns" --interface "default_prompt=Use $playims-style-builder to build this dashboard UI so it matches PlayIMs style, wizard, and form conventions."
```

Verify reference files exist:

```powershell
Get-ChildItem ".codex/skills/playims-style-builder/references/*.md" | Select-Object -ExpandProperty Name
```

Verify `SKILL.md` links all required references:

```powershell
Select-String -Path ".codex/skills/playims-style-builder/SKILL.md" -Pattern "style-foundation.md|dashboard-layout-recipes.md|wizard-recipes.md|forms-and-controls.md|feedback-and-danger-patterns.md|class-recipes.md|migration-map.md|qa-gates.md"
```

Confirm no accidental changes to legacy cursor skill:

```powershell
git diff -- ".cursor/skills/style/SKILL.md"
```

Expectation:

- This should show no changes introduced by this migration task.

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
