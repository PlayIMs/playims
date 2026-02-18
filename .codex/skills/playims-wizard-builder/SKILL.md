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

7. Apply destructive action standards when needed.

- For delete/archive flows, include explicit impact copy, typed slug confirmation, and irreversible warning language.
- Disable destructive submit until typed confirmation matches normalized target slug.
- Keep destructive controls visually isolated in a dedicated danger section.

8. Enforce step-by-step validation.

- Validate the current step before advancing on every Next action; do not defer validation to final submit.
- Include uniqueness checks (for example name/slug duplicates) on the earliest relevant step when local data allows it.
- Keep final submit validation as a safety net, but users should get actionable errors before they progress.

9. Validate.

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
- For destructive wizard actions, do not rely on single-click confirmations; require typed confirmation when data loss scope is broad.
- Do not allow step advancement when current-step validation fails; Next handlers must run explicit current-step validation before incrementing the step.
- Keep scope to dashboard routes unless user expands scope.

## Delivery Checklist

Always report:

1. Files added/updated.
2. Behavioral parity notes and any intentional UX deviations.
3. Validation command results.
4. Manual QA coverage summary.
