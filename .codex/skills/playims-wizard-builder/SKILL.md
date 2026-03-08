---
name: playims-wizard-builder
description: Build or refactor PlayIMs dashboard wizard modals with the shared wizard system. Use when adding a new multi-step modal, migrating an inline wizard to shared components, standardizing wizard UX/UI, or reusing draft-list and unsaved-change flows under src/routes/dashboard/**.
---

# PlayIMs Wizard Builder

## Goal

Implement wizard modals in PlayIMs with consistent UX, shared components, parity-safe behavior, and route-local wizard components.

## Start Here

Read these files before making changes:

- `docs/wizard-system.md`
- `src/lib/components/wizard/index.ts`
- `src/lib/components/wizard/WizardModal.svelte`
- `src/lib/components/wizard/WizardStepFooter.svelte`
- `src/lib/components/wizard/WizardUnsavedConfirm.svelte`
- `src/lib/components/wizard/WizardDraftCollection.svelte`
- `src/lib/components/modals/ModalShell.svelte`
- `src/lib/components/InfoPopover.svelte`
- `src/lib/components/HoverTooltip.svelte`
- `src/lib/components/floating-position.ts`
- Existing route examples:
- `src/routes/dashboard/facilities/_wizards/CreateFacilityWizard.svelte`
- `src/routes/dashboard/intramural-sports/_wizards/CreateOfferingWizard.svelte`
- `src/routes/dashboard/intramural-sports/_wizards/CreateLeagueWizard.svelte`

## Required Architecture

Follow this structure:

1. Keep data loading, fetch/actions, and primary state in route `+page.svelte`.
2. Place wizard UI shell in a route-local component:

- `src/routes/dashboard/[route]/_wizards/[WizardName].svelte`

3. Use shared primitives instead of custom shell markup:

- `WizardModal`
- `WizardStepFooter`
- `WizardUnsavedConfirm`

4. Use `WizardDraftCollection` for list/draft steps (add/edit/copy/move/remove).
5. Use shared utilities from `$lib/components/wizard`:

- `slug-utils`
- `wizard-field-errors`
- `create-draft-collection-controller`

6. For any new select/dropdown UI in wizards, use `src/lib/components/ListboxDropdown.svelte` and follow `$playims-listbox-dropdown-builder`; do not introduce native `<select>` controls.
7. Use snippet/render patterns (`{#snippet ...}` / `{@render ...}`), not legacy `<slot>`.
8. For any new info/help popover in wizards, use `src/lib/components/InfoPopover.svelte` and follow `$playims-info-popover-builder`; do not introduce ad-hoc popover implementations.
9. For wizard-adjacent admin entry points, prefer `ListboxDropdown` footer actions (primary and optional secondary icon action) to keep context actions in-flow.
10. For hover hints on wizard controls (edit/copy/remove/revert icons and similar), use `HoverTooltip` and follow `$playims-hover-tooltip-builder`; do not use native `title` attributes.

### InfoPopover Placement In Wizards

- Use the default `InfoPopover` trigger style (boxed icon button) for step-panel helpers, section headers, and standalone helper affordances.
- For form-label-adjacent helpers (for example `Name` / `Slug` labels), use `buttonVariant="label-inline"` and a shared label row wrapper: `mb-1 flex min-h-6 items-center gap-1.5`.
- Keep label text in the same row with `text-sm` and `leading-6` so fields align even when only one label has a popover.
- Keep label-adjacent popover copy concise and supplemental; required guidance should still be visible inline near the field.
- Keep `buttonAriaLabel` context-specific in both cases.

### Slug Field Revert Control

- For wizard slug inputs, include an inline revert icon button inside the input on the far right (`relative` wrapper + input `pr-10` + absolute icon button).
- Use project `HoverTooltip` with text `Revert to default` for this action; do not use `InfoPopover` for the revert control.
- Keep hover behavior cursor-relative (shared `HoverTooltip` behavior); do not add one-off tooltip positioning in wizard files.
- Keep the revert icon button visually unboxed (`border-0 bg-transparent`) and out of keyboard tab order with `tabindex="-1"`.
- Revert behavior must reset slug manual/touched state and restore the auto-generated default slug from the current source name(s).

### Compact Switcher Modals

For single-step switchers such as `Switch View Role`, `Switch Organization`, or similar account/context pickers:

- Use `WizardModal`, not ad-hoc modal markup.
- Keep them visually and behaviorally aligned across routes; a new switcher should look like a sibling of the existing role/org switchers, not a separate modal family.
- Use `maxWidthClass="max-w-lg"` unless the user explicitly asks for a larger switcher.
- Use one summary panel at the top with current-state context and concise keyboard guidance.
- Use a single-column list of selectable button cards with matching spacing, padding, and keycap placement across switchers.
- Keep focus treatment square and token-based: use border changes like `focus-visible:outline-none focus-visible:border-primary-700`; do not rely on browser default outlines.
- Preserve the shared keyboard model unless the user asks otherwise: Up/Down navigation, Shift-assisted reverse traversal, Enter to submit, and context-appropriate quick keys.
- Quick-key instructions must reflect only the keys actually available to the user in that switcher.
- When one switcher in a route is updated, compare nearby switchers and keep parity unless the user explicitly requests divergence.

## Workflow

1. Ground current behavior.

- Inspect existing step flow, branching, field validation, submit payload, and unsaved-close behavior.
- Capture parity requirements before refactor.

2. Implement or extract wizard component.

- Move modal frame and step sections to `_wizards/[WizardName].svelte`.
- Keep prop contract explicit and typed.

3. Standardize UX logic.

- Replace native unsaved `window.confirm` for wizard close with `WizardUnsavedConfirm`.
- Keep existing in-flow confirms unless explicitly asked to change them.
- Use `InfoPopover` for paragraph-heavy helper/explanatory content instead of ad-hoc `<details>` patterns, and follow `$playims-info-popover-builder` for behavior/styling consistency.

4. Standardize draft-list logic.

- Use `WizardDraftCollection` UI and draft controller helpers for reorder/removal/edit-index adjustments.

5. Standardize select/dropdown controls.

- Migrate new wizard select/dropdown interactions to `ListboxDropdown`.
- Keep native `<select>` only when preserving existing parity and no new dropdown is being introduced.

6. Rewire route page.

- Replace inline wizard markup with route wizard component.
- Preserve existing API payloads and action endpoints unless explicitly requested otherwise.
7. Standardize wizard hover tooltip affordances.

- Replace wizard-native `title` hover hints with `HoverTooltip` wrappers when touched.
- Keep tooltip text concise and action-specific (for example: `Edit facility`, `Edit areas`, `Sign out this session`).

8. Standardize compact switchers when present.

- Align any new or edited switcher wizard with the existing compact switcher pattern before inventing a new structure.
- Reuse the same summary block, option card structure, and keycap placement as nearby switchers unless there is a clear product reason not to.

9. Apply destructive action standards when needed.

- For delete/archive flows, include explicit impact copy, typed slug confirmation, and irreversible warning language.
- Disable destructive submit until typed confirmation matches normalized target slug.
- Keep destructive controls visually isolated in a dedicated danger section.

10. Enforce step-by-step validation.

- Validate the current step before advancing on every Next action; do not defer validation to final submit.
- Include uniqueness checks (for example name/slug duplicates) on the earliest relevant step when local data allows it.
- Keep final submit validation as a safety net, but users should get actionable errors before they progress.
- Keep Next disabled whenever current-step client validation fails.
- Merge server field errors into the current-step error map so users see conflicts on the step where they entered data.
- If validation fails on Next, keep focus in-step and do not advance step index.
- Do not render field-level validation messages under inputs until the user attempts `Next` or `Submit` for the active step, unless the message is coming from the server.
- After a step has been attempted, keep that step's field errors live while the user corrects them.
- For single-step submit-only wizards, do not rely on untouched hidden validation plus a permanently disabled submit button; users must be able to attempt submit and reveal the current step errors.

11. Enforce unsaved-change protection across close and browser navigation.

- If the wizard has dirty state, closing the modal through its own close affordances must route through `WizardUnsavedConfirm`.
- If the user refreshes, closes the tab/window, or triggers page/back navigation while the wizard is dirty, use the browser-native confirmation path (`beforeunload` and route/navigation interception as appropriate).
- Keep these browser-level prompts active only while the wizard is open and actually dirty.

12. Validate.

- Run `pnpm check`.
- Run `pnpm build` for larger changes.
- Run manual QA matrix in `references/qa-matrix.md`.

## Guardrails

- Keep numeric step IDs unless asked to change.
- Preserve existing copy and behavior by default (parity-first).
- Prefer splitting dense content into additional wizard steps instead of relying on in-panel scroll.
- Do not change backend schemas/migrations/API contracts unless requested.
- If adding a new `/api/...` endpoint for the wizard, update security policy map and rate limiting in `src/hooks.server.ts` (`API_ROUTE_POLICIES` and `resolveRateLimitConfig`) to avoid 403 policy blocks.
- For all newly added wizard select/dropdown controls, use `ListboxDropdown` and not native `<select>`.
- For all newly added wizard info/help popovers, use `InfoPopover` and follow `$playims-info-popover-builder`; do not ship custom popover variants.
- For all wizard form labels that include an info popover, use the shared label-row alignment pattern and `buttonVariant="label-inline"` for consistent field alignment.
- For wizard slug fields, include the shared inline revert control with `HoverTooltip` and reset touched/manual flags when reverting.
- Do not ship wizard hover hints with native `title` attributes; use shared `HoverTooltip`.
- Do not let compact switcher modals drift into separate visual systems; keep role/org/context switchers matched in width, structure, and interaction model by default.
- For destructive wizard actions, do not rely on single-click confirmations; require typed confirmation when data loss scope is broad.
- Do not allow step advancement when current-step validation fails; Next handlers must run explicit current-step validation before incrementing the step.
- Do not ship wizards that rely on submit-only validation for required fields, duplicates, or format errors.
- Do not show untouched step-level field errors on first render.
- Do not skip browser-native unsaved prompts for refresh, tab close, or page/back navigation when a wizard has dirty state.
- Keep scope to dashboard routes unless user expands scope.

## Delivery Checklist

Always report:

1. Files added/updated.
2. Behavioral parity notes and any intentional UX deviations.
3. Validation command results.
4. Manual QA coverage summary.
5. Step-validation proof:
   - Confirmed Next blocks advancement when current step has errors.
   - Confirmed duplicate/uniqueness checks surface on the earliest relevant step.
   - Confirmed final submit validation remains as a safety net.
6. Unsaved-state proof:
   - Confirmed modal close uses `WizardUnsavedConfirm` when the wizard is dirty.
   - Confirmed refresh/tab-close/native navigation prompts appear only while the wizard is dirty.
