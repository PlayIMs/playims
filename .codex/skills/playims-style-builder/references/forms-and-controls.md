# Forms And Controls

## Contents

1. Form layout baseline
2. Label and helper alignment
3. Text input and textarea rules
4. Date field pattern
5. Slug revert pattern
6. Toggle and radio standards
7. Dropdown standards
8. Helper popover and tooltip standards
9. Date display tooltip rule
10. Structural/accessibility guardrails
11. Svelte runes and event rules

## Form Layout Baseline

- Use `space-y-4` per step block and `gap-4` field grids.
- Keep labels as `text-sm font-sans text-neutral-950`.
- Keep error text as `text-xs text-error-700 mt-1`.
- Use themed component classes from `app.css`; avoid raw input styling unless necessary.

## Label And Helper Alignment

Label-only baseline:

- `label` class: `block text-sm font-sans text-neutral-950 mb-1`

Label + inline popover baseline:

- Row wrapper: `mb-1 flex min-h-6 items-center gap-1.5`
- Label text: `text-sm leading-6 font-sans text-neutral-950`
- Popover button: `InfoPopover buttonVariant="label-inline"`

Use this consistently for slug and advanced helper labels.

## Text Input And Textarea Rules

Primary field classes:

- Text/date/search inputs: `input-secondary`
- Long-form text: `textarea-secondary min-h-28`

Shared search bar rule:

- Use `src/lib/components/SearchInput.svelte` for page searches, wizard list searches, filter searches, and other free-text lookup fields.
- Keep the offerings page as the source of truth for the default visual treatment.
- Prefer prop/class tuning on `SearchInput` over rebuilding search markup inline.

Common field add-ons:

- Input with inline action icon: `input-secondary pr-10`
- Search-like field with left icon: `input-secondary pl-10`
- Error state override: `input-secondary border-error-400 focus:border-error-600`
- Inline icon buttons rendered inside an input wrapper must use `tabindex="-1"` when they are secondary conveniences (clear, reveal password, revert, open date picker, inline helper affordances) so the main field stays in the keyboard tab flow.
- Default `SearchInput` clear affordance follows the same rule and appears only when a value exists.

## Date Field Pattern

When custom calendar trigger is rendered:

- Input: `input-secondary pr-9 no-native-date-picker`
- Trigger button: `absolute right-2 top-1/2 -translate-y-1/2 text-secondary-900 hover:text-secondary-700 cursor-pointer`
- Trigger button also uses `tabindex="-1"` because it is an in-field convenience control, not a primary stop in the form sequence.

Keep native date value handling intact and avoid nesting extra form controls.

## Slug Revert Pattern

Use this exact pattern for slug fields in wizards:

1. Input wrapper: `relative`.
2. Input class: `input-secondary pr-10`.
3. Revert icon in `HoverTooltip` with text `Revert to default`.
4. Revert button style:
   - `-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none`
5. Revert button `tabindex="-1"` to keep main field flow.
6. Revert action resets slug touched/manual flags and regenerates default slug.

## Toggle And Radio Standards

- Toggles use `toggle-secondary`.
- Radios use `radio-secondary`.
- Use `src/lib/components/ToggleField.svelte` for bordered toggle rows where the switch sits inside the same field shell as its label content.
- Use `src/lib/components/DayOfWeekButtonGroup.svelte` for single-choice weekday selection when a day field is optional but should feel faster than a plain text input.
- `ToggleField` is the default pattern for wizard/admin controls such as `Start this division locked` or `Add this team to the waitlist`.
- Default posture: make the bordered toggle shell visually match `input-secondary` sizing and border treatment.
- `ToggleField` supports label placement on either side of the toggle; prefer label text on the right unless the layout has a clear reason to invert it.
- Selection cards should remain squared (`border`, `bg-white`/`bg-secondary-50`), while radio circles stay circular per `app.css`.
- Button-based weekday selectors should keep a bordered field shell, use a 7-option single-select grid, and allow clearing back to no selection when the field is not required.

Common selection-card recipe:

- `flex items-start gap-2 border p-3 text-sm text-neutral-950 min-w-0`
- Selected state: `border-secondary-600 bg-secondary-50`
- Unselected: `border-secondary-300 bg-white`

## Dropdown Standards

- Use `ListboxDropdown` for new dropdown/select interactions.
- Do not add new native `<select>` controls for dashboard UI.
- Default compact icon trigger:
  - `button-secondary-outlined p-1.5 cursor-pointer`
- Default form-field trigger:
  - reuse `FORM_DROPDOWN_BUTTON_CLASS` from nearby route patterns if present.
- For implementation details, use `$playims-listbox-dropdown-builder`.
- Ground implementation against current hotspots:
  - `src/routes/dashboard/offerings/+page.svelte`
  - `src/routes/dashboard/account/+page.svelte`

## Helper Popover And Tooltip Standards

- Use `InfoPopover` for click-persistent helper content (paragraphs, explanatory notes).
- Use `HoverTooltip` for short action hints (edit/duplicate/remove/revert icons).
- Do not repeat the same supplemental guidance both inline and inside an `InfoPopover`.
- Do not add helper banners or extra visible helper paragraphs when a nearby `InfoPopover` can hold that non-critical explanation.
- Keep visible helper copy only when it is dynamic, state-specific, validation-related, or otherwise necessary for the user to act immediately.
- Do not use native `title` attributes for new hints.
- If a tooltip-wrapped icon button lives inside an input field or as an inline field affordance, keep it out of the tab order with `tabindex="-1"`. Do not apply this to primary page actions, menu items, or standalone buttons that need normal keyboard focus.
- Ground popover/tooltip behavior against current hotspots:
  - `src/routes/dashboard/offerings/+page.svelte`
  - `src/routes/dashboard/account/_wizards/ManageOrganizationWizard.svelte`
  - `src/routes/dashboard/offerings/_wizards/ManageSeasonWizard.svelte`
  - `src/routes/dashboard/+layout.svelte`

Use companion skills:

- `$playims-info-popover-builder`
- `$playims-hover-tooltip-builder`

## Date Display Tooltip Rule

- Any visible date or datetime text in the UI must render with `DateHoverText` (`src/lib/components/DateHoverText.svelte`).
- Keep visible copy compact for the layout, but pass raw source values so the tooltip can render the full canonical format.
- Tooltip format contract:
  - Date only: `Monday, January 01, 2026`
  - Date + time: `Monday, January 01, 2026, 11:59PM EST`
- Set `includeTime` when the visible date string includes time.
- For ranges, pass both `value` and `endValue` so the tooltip resolves the full start/end date context.
- If sentence copy includes extra words (for example, `Expires ...`), wrap only the date portion with `DateHoverText` and keep surrounding text outside.
- Do not use native `title` attributes or ad-hoc tooltip code for date display behavior.

## Structural/Accessibility Guardrails

- Never nest `<form>` inside another `<form>`.
- Use semantic interactive elements for click/keyboard actions (`button`, `a`).
- If non-interactive elements must capture actions, add role/tabindex/keyboard handling.
- Keep modal backdrop interactions keyboard-accessible when using `div` overlays.
- Maintain touch-friendly controls for mobile/iPad.

## Svelte Runes And Event Rules

- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`).
- Prefer snippet/render composition over legacy slots for wizard structures.
- Keep event handlers on interactive elements whenever possible.
