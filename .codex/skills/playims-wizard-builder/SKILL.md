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
6. Use snippet/render patterns (`{#snippet ...}` / `{@render ...}`), not legacy `<slot>`.

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
- Use `InfoPopover` for paragraph-heavy helper/explanatory content instead of ad-hoc `<details>` patterns.
4. Standardize draft-list logic.
- Use `WizardDraftCollection` UI and draft controller helpers for reorder/removal/edit-index adjustments.
5. Rewire route page.
- Replace inline wizard markup with route wizard component.
- Preserve existing API payloads and action endpoints unless explicitly requested otherwise.
6. Validate.
- Run `pnpm check`.
- Run `pnpm build` for larger changes.
- Run manual QA matrix in `references/qa-matrix.md`.

## Guardrails
- Keep numeric step IDs unless asked to change.
- Preserve existing copy and behavior by default (parity-first).
- Prefer splitting dense content into additional wizard steps instead of relying on in-panel scroll.
- Do not change backend schemas/migrations/API contracts unless requested.
- If adding a new `/api/...` endpoint for the wizard, update security policy map and rate limiting in `src/hooks.server.ts` (`API_ROUTE_POLICIES` and `resolveRateLimitConfig`) to avoid 403 policy blocks.
- Keep scope to dashboard routes unless user expands scope.

## Delivery Checklist
Always report:
1. Files added/updated.
2. Behavioral parity notes and any intentional UX deviations.
3. Validation command results.
4. Manual QA coverage summary.
