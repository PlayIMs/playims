---
name: playims-style-builder
description: Build or refactor PlayIMs dashboard pages and wizard UI with codebase-aligned Tailwind recipes, theme token discipline, shared component conventions, and toast-first transient feedback. Use when adding or modifying src/routes/dashboard/** layouts, forms, action bars, feedback states, and destructive flows so new UI matches offerings, toasts, and shared wizard patterns.
---

# PlayIMs Style Builder

## Goal

Build UI that is visually and behaviorally consistent with the current PlayIMs app, especially the module-page shell established in `src/routes/dashboard/offerings/+page.svelte`, the matching page-header pattern now used across dashboard module pages, and shared wizard primitives.

## Trigger Conditions

Use this skill when the task includes any of these:

- Building or restyling dashboard page sections under `src/routes/dashboard/**`.
- Adding or editing wizard modal steps, forms, review sections, and action footers.
- Choosing classes for form controls, alerts, action buttons, badges, and cards.
- Replacing transient success/error banners with shared toast feedback.
- Implementing delete/danger confirmation UX (typed slug, irreversible copy, action states).
- Migrating inconsistent native controls or helper UI to shared components.

Use companion skills with this one:

- `$playims-wizard-builder` for shared wizard architecture and behavior.
- `$playims-listbox-dropdown-builder` for dropdown/select patterns.
- `$playims-info-popover-builder` for helper popovers.
- `$playims-hover-tooltip-builder` for hover hints and action tooltips.
- `$playims-toast-builder` for transient notifications and banner-to-toast migrations.

## Start Here

Read these files before editing UI:

- `src/routes/dashboard/offerings/+page.svelte`
- `src/routes/dashboard/members/+page.svelte`
- `src/routes/dashboard/settings/+layout.svelte`
- `src/routes/dashboard/facilities/+page.svelte`
- `src/lib/components/wizard/WizardModal.svelte`
- `src/lib/components/wizard/WizardStepFooter.svelte`
- `src/lib/components/wizard/WizardDraftCollection.svelte`
- `src/lib/components/wizard/WizardUnsavedConfirm.svelte`
- `src/lib/components/ListboxDropdown.svelte`
- `src/lib/components/InfoPopover.svelte`
- `src/lib/components/HoverTooltip.svelte`
- `src/lib/components/toast/Toaster.svelte`
- `src/lib/components/toast/ToastItem.svelte`
- `src/lib/toasts.ts`
- `src/lib/components/floating-position.ts`
- `src/app.css`
- `src/lib/theme.ts`
- `docs/wizard-system.md`

## Mandatory Shared UI Systems

These are required for consistency in new dashboard UI:

- `ListboxDropdown` for dropdown/select interactions.
- `InfoPopover` for click-persistent explanatory helper copy.
- `HoverTooltip` for short hover/focus hints on controls.
- Shared `toast` API for transient success/error/warning/info/loading feedback.

Do not replace these with ad-hoc alternatives for new work.

Ground in existing app usage before implementing:

- `src/routes/dashboard/offerings/+page.svelte` (canonical module-page shell and heavy shared-component usage).
- `src/routes/dashboard/members/+page.svelte` (matching clean module header with relocated page action).
- `src/routes/dashboard/settings/+layout.svelte` (settings-area shell that inherits the same module header structure).
- `src/routes/dashboard/account/+page.svelte` and `src/routes/dashboard/account/_wizards/ManageOrganizationWizard.svelte`.
- `src/routes/dashboard/offerings/_wizards/ManageSeasonWizard.svelte`.
- `src/routes/dashboard/facilities/_wizards/CreateFacilityWizard.svelte`.
- `src/routes/dashboard/+layout.svelte` (navigation and layout-level tooltip behavior).

Default class recipes to copy first:

- Module page shell: outer `w-full space-y-4` root with a full-width header strip followed by a body wrapper
- Module header strip: `<header class="bg-neutral">` with inner `border-b border-secondary-300 bg-neutral-600/66 p-4`
- Module header row: `flex items-center gap-3 py-2 lg:py-3`
- Module header icon tile: `bg-primary text-white border-2 border-primary-700 w-[2.75rem] h-[2.75rem] lg:w-[3.4rem] lg:h-[3.4rem] flex items-center justify-center`
- Module page title: `text-5xl lg:text-6xl leading-[0.9] tracking-[0.01em] font-bold font-serif text-neutral-950`
- Module body wrapper: `px-4 lg:px-6`
- Module action/meta row: place page actions, timestamps, counts, and utility controls below the header inside the body wrapper, not inside the title strip
- Compact icon dropdown trigger: `button-secondary-outlined p-1.5 cursor-pointer`
- Split add-menu dropdown trigger: `button-primary-outlined -ml-[2px] px-1 py-1 cursor-pointer`
- Label-inline helper popover row: `mb-1 flex min-h-6 items-center gap-1.5`
- Slug revert tooltip button: `border-0 bg-transparent ... text-secondary-700 hover:text-secondary-900`

### Switcher Modal Recipe

Use this recipe for compact single-step switchers such as role switchers, organization switchers, or similar context pickers:

- Keep the modal width aligned to the existing switcher pattern: `maxWidthClass="max-w-lg"`.
- Start with a small summary block: `border border-secondary-300 bg-white p-2.5`.
- Summary copy should stay to one or two short lines and describe the current state first.
- Use a single-column option stack: `grid grid-cols-1 gap-2`.
- Option cards should use `group relative border p-2.5 pr-14 text-left cursor-pointer`.
- Focus styling should stay square and border-based: `focus-visible:outline-none focus-visible:border-primary-700`.
- Active or highlighted cards should use `border-primary-500 bg-primary-100 text-primary-900`.
- Inactive cards should use `border-secondary-300 bg-white text-neutral-950 hover:bg-secondary-50`.
- Keyboard keycaps should use the same small chip treatment as the role switcher and org switcher; do not invent a second visual style.
- Do not rely on browser default focus rings or rounded black outlines for switcher cards.
- Keep switcher option descriptions terse and action-oriented so parallel switchers read like siblings.
- Do not include the current state as a selectable option when it is already summarized at the top of the switcher; mirror the role/org switcher pattern and list only valid alternatives.

## Module Page Shell

Use `src/routes/dashboard/offerings/+page.svelte` as the source of truth for dashboard module pages.

Required structure:

1. Root page wrapper uses `w-full space-y-4`.
2. Header stays full-width and uses only the thin bottom divider.
3. Header contains only the icon tile and page title unless the user explicitly asks for another header element.
4. Body content lives in a separate wrapper using `px-4 lg:px-6`.
5. Actions, timestamps, badges, counts, filters, and helper controls live below the header inside the padded body area.

Do not use the older boxed hero shell for module pages:

- Do not wrap the whole page in `p-6 lg:p-8` when the goal is a standard dashboard module page.
- Do not use `border-2 border-secondary-300 bg-neutral p-5` as the module header container.
- Do not put page subtitles in the module header by default.
- Do not place primary action buttons in the module header by default.

For settings pages:

- Prefer updating `src/routes/dashboard/settings/+layout.svelte` when the whole settings area should share the shell.
- Keep individual settings child pages focused on their local content cards/sections instead of reintroducing separate hero headers.

## Required Workflow

1. Ground existing UI patterns in the nearest dashboard page and wizard route.
2. Match dashboard module pages to the offerings-page module shell unless the user explicitly requests a deliberate exception.
3. Choose layout recipes from `references/dashboard-layout-recipes.md`.
4. Choose wizard recipes from `references/wizard-recipes.md` if modals/steps are involved.
5. Apply form/control recipes from `references/forms-and-controls.md`.
6. Apply transient feedback rules from `references/toast-patterns.md`.
7. Apply inline/danger recipes from `references/feedback-and-danger-patterns.md`.
8. Reuse copyable class strings from `references/class-recipes.md` before inventing new class mixes.
9. Resolve any flat-vs-rounded conflicts with the hybrid policy in `references/style-foundation.md`.
10. Run all required gates in `references/qa-gates.md` before finishing.

## Progressive Disclosure Map

Load reference files only as needed:

- `references/style-foundation.md`: design intent, token usage, typography, border hierarchy, and hybrid shape policy.
- `references/dashboard-layout-recipes.md`: page shell and dashboard section recipes.
- `references/wizard-recipes.md`: modal framing, step structure, draft/review/action patterns.
- `references/forms-and-controls.md`: labels, controls, helpers, dropdown/popover/tooltip integration.
- `references/toast-patterns.md`: toast-first transient feedback rules, titles, and action patterns.
- `references/feedback-and-danger-patterns.md`: inline error and destructive action patterns that stay in-page or in-modal.
- `references/class-recipes.md`: canonical class strings and quick pick matrix.
- `references/migration-map.md`: lossless mapping from legacy `.cursor` style skill.
- `references/qa-gates.md`: strict acceptance checklist and command gates.

## Hybrid Visual Policy

Default posture:

- Keep page chrome, cards, panels, and most controls square/flat.
- Favor explicit borders (`border`, `border-2`, `border-4`) and hard edges.

Allowed exceptions (already deployed in codebase):

- Radio controls and inner radio dots (`border-radius: 50%` in `app.css`).
- Small keycap/code confirmation chips in danger confirmations (`rounded`/`rounded-sm` chip usage).
- Existing component-level affordances that are already live and scoped (do not broaden them into new page chrome).

When legacy guidance and current implementation differ, prefer current implementation with these explicit exceptions.

## Guardrails

- Do not introduce native `<select>` for new dashboard selectors; use `ListboxDropdown`.
- Do not ship new helper popover variants; use `InfoPopover`.
- Do not ship new hover hints using native `title`; use `HoverTooltip`.
- Do not use the old boxed module hero pattern when building or refactoring dashboard module pages.
- Do not place default module actions, subtitles, timestamps, or helper copy inside the module header strip.
- Do not remove body gutters after moving to the full-width header pattern; preserve body spacing with `px-4 lg:px-6` or a route-specific equivalent derived from the offerings page.
- Do not mix full-width header strips with page-wide outer padding that insets the header away from the sidebar or scrollbar.
- Do not ship new transient success/error banners; use the shared toast system.
- Use the shared toast system for success, error, and warning confirmation because it avoids shifting the page layout the way banners do.
- Do not replace input validation with toasts; validation should stay next to the relevant field.
- When styling tinted feedback surfaces like toasts, use dark variant-aware text colors rather than neutral-950 or pure black on colored backgrounds.
- When styling toast actions, do not reuse generic page buttons; use toast-local button treatments that inherit the toast color family, with `solid` and `outline` variants as needed.
- For toast actions, prefer `solid` for the safe or forward-moving action and `outline` for the unsafe, cancel, back, or dismissive action.
- Do not use browser/native confirmation dialogs (`window.confirm`) for destructive actions.
- All destructive confirmations (delete, leave, archive, remove) must use a custom confirmation modal pattern.
- Do not bypass shared wizard primitives for new multi-step modals.
- Do not nest `<form>` elements.
- Keep Svelte 5 runes patterns and snippet/render conventions consistent with current codebase.
- Keep touch usability and mobile/iPad layouts first-class; avoid hover-only critical interactions.

## Required Validation

Always execute and report:

1. `references/qa-gates.md` command checks.
2. Any UI behavior checks relevant to touched surfaces.
3. Any intentional deviations from canonical recipes with reasons.
