# Style Foundation

## Contents

1. Source-of-truth files
2. Visual intent
3. Theme token rules
4. Typography rules
5. Border and shape hierarchy
6. Focus and interaction states
7. Accessibility and contrast rules
8. Icon standards

## Source-of-Truth Files

- `src/app.css`
- `src/lib/theme.ts`
- `src/app.html`
- `src/routes/dashboard/offerings/+page.svelte`
- `src/lib/components/wizard/WizardModal.svelte`

## Visual Intent

- The dominant app style is flat, squared, and border-driven.
- Most panels and surfaces use explicit borders instead of shadows.
- Neutral surfaces (`bg-neutral`, `bg-white`) and strong text contrast are the baseline.
- Decorative rounding is not the default.

## Theme Token Rules

- Use project semantic tokens and classes, not hardcoded one-off colors.
- Prefer component classes from `app.css`:
  - Inputs: `input-primary|secondary|accent`
  - Textareas: `textarea-primary|secondary|accent`
  - Selects: `select-primary|secondary|accent`
  - Toggles: `toggle-primary|secondary|accent`
  - Radios: `radio-primary|secondary|accent`
  - Buttons: `button-primary|secondary|accent|error` and outlined variants
  - Status: `badge-*`, `card-*`
- Use color roles as intent:
  - `primary`: brand/high-priority status.
  - `secondary`: structural control/surface system.
  - `neutral`: base page and content surfaces.
  - `accent`: highlighted actions and emphasis.
  - `error|warning`: destructive or caution messaging.

## Typography Rules

- Global fonts are Inter (sans) + Bitter (serif) from `src/app.html`.
- Serif (`font-serif`) is used for large page and section headings.
- Sans (`font-sans`) is used for body copy, labels, helper text, and controls.
- Common heading scale in dashboard/wizards:
  - Page hero: `text-5xl` / `text-6xl` + `font-serif` + tight leading.
  - Section heading: `text-xl` or `text-2xl` + `font-bold` + `font-serif`.
  - Labels/body/meta: `text-sm` / `text-xs` with readable contrast.
- Uppercase micro-labels use tight tracking:
  - `text-[11px] uppercase tracking-wide font-bold`.

## Border And Shape Hierarchy

- Outer containers generally use stronger borders:
  - `border-2 border-neutral-950` for page/section shells.
  - `border-4 border-secondary` or `border-4 border-error-700` for modal panels.
- Inner nested content uses thinner borders:
  - `border border-neutral-950` for cards/rows/subsections.
- This preserves old style guidance that nested inner boundaries should be thinner.
- Interactive controls may still use `secondary-300` when that lighter border communicates an unselected or inactive control state.

Shape defaults:

- Keep containers square: no new rounded page shells/cards/toolbars.
- Keep buttons and controls aligned with existing component classes (square look).

Hybrid exceptions (explicitly allowed):

- Radio controls and radio selection dots are circular by design (`app.css`).
- Small keycap/code confirmation chips in destructive dialogs may use `rounded` or `rounded-sm`.
- Existing scoped component affordances that already ship may remain unchanged.

## Focus And Interaction States

- Rely on themed focus behavior from `app.css` rather than adding custom blue rings.
- Keep explicit keyboard-visible focus on interactive controls:
  - Typical pattern: `focus-visible:ring-2 focus-visible:ring-<theme>`.
- Disabled controls should visually dim and set `cursor-not-allowed`.
- Preserve hover + focus parity; do not make critical actions hover-only.

## Accessibility And Contrast Rules

- On neutral backgrounds, use dark text (`text-neutral-950` / `text-neutral-900`).
- Avoid low-contrast neutral text for critical instructions.
- Keep target sizes touch-usable, especially icon buttons and compact controls.
- Keep iPad and mobile widths functional:
  - Avoid clipping action bars.
  - Use controlled overflow regions for dense tables/lists.
- Prefer readable, visible inline instructions for critical steps.
- Popovers/tooltips are supplemental, not the sole source of required instructions.

## Icon Standards

- Use Tabler icons (`@tabler/icons-svelte`) consistently.
- Keep icon-only action buttons compact and bordered for dashboard consistency.
- Common action semantics:
  - Edit: pencil icon in secondary/neutral tone.
  - Delete/destructive: trash/logout icon with error tone.
  - Helper text: info icon with `InfoPopover`.
  - Hover hints: `HoverTooltip` wrapper, not native `title`.
