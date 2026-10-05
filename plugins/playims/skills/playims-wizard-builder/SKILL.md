---
name: playims-wizard-builder
description: Build or migrate PlayIMs dashboard wizard modals with shared wizard primitives, route-local wrappers, step validation, and unsaved-change protection.
---

# PlayIMs Wizard Builder

Build dashboard wizards that match offerings interactions and preserve the active route's state and API contracts.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `docs/wizard-system.md`, `$lib/components/wizard`, and the active route's `_wizards/` wrapper. Use `src/routes/dashboard/offerings/_wizards/CreateOfferingWizard.svelte` or `CreateLeagueWizard.svelte` as a matching consumer.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Keep loading, mutations, and primary state in the route; use typed props in `_wizards/[WizardName].svelte`. Use `WizardModal`, `WizardStepFooter`, and `WizardUnsavedConfirm`; use `WizardDraftCollection` and draft controllers for collection steps. Use Svelte 5 snippets rather than legacy slots.
- Validate the current step before every Next transition. Required, format, range, and duplicate errors belong on the earliest relevant step. Show field errors after a step attempt or server response, then keep them live; final submit validation remains a safety net. Single-step forms must allow an attempt to reveal errors.
- Route dirty modal-close requests through `WizardUnsavedConfirm`. Protect refresh/tab-close and route navigation while open and dirty; remove those protections when clean or closed.
- Use shared dropdowns, popovers, hover hints, and toasts. Slug revert restores generated text and resets manual/touched flags. Preserve numeric step IDs and shared thin scrollbars; prefer additional steps over dense scrolling.
- Keep compact role/org switchers aligned in width, keyboard handling, summary, and option cards. Use `saveShortcutEnabled` for save-only shortcuts; avoid duplicate dismiss-only footer buttons or duplicate shell close controls.
- Preserve API payloads. A new endpoint also needs applicable policy/rate-limit handling in `src/hooks.server.ts`. Destructive actions need impact copy and typed confirmation for broad data loss.

## Shared ownership

Wrap custom input fields in `modal-field` and use `$lib/components/FieldError.svelte` for validation copy. The shared modal CSS reserves one compact error line even when empty; never add conditional error margins, multiline errors, or duplicate messages outside the field. DatePicker and TimeInput own their parsing errors. Keep longer explanations in an InfoPopover rather than expanding the error row.

Use `ModalShell title="..."` or `WizardModal` for framing, with `ModalHeader` as the shared title/X owner. Keep `panelClass` for layout only and use `tone="danger"` for destructive variants. Put actions in the wizard `footer` snippet; `formClass` styles its scrolling body. Use `modal-body`, `modal-footer`, and `modal-actions` for direct modals and `ListboxDropdown variant="field"` for form selectors. Implement global requests at the shared component/CSS owner first; migrate copied consumers rather than adding more route-local overrides. Preserve documented embedded editor/command-palette exceptions.

## Read detail when needed

- [integration contract](references/integration-contract.md): Step/error timing, switcher recipes, slug controls, and migration details.
- [qa matrix](references/qa-matrix.md): Interaction cases for the changed wizard; select relevant cases.

## Done when

The active route uses the intended wrapper; Next blocks invalid transitions, errors appear at the correct time, and close/navigation protection follows dirty state. Report the checks actually performed. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
