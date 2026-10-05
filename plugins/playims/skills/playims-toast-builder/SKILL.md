---
name: playims-toast-builder
description: Integrate transient PlayIMs feedback through the shared toast API, including async updates and recovery actions. Keep field errors inline and persistent impact copy in modals.
---

# PlayIMs Toast Builder

Use the shared toast system for transient feedback without shifting page layout.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `src/lib/toasts.ts` and the active consumer; inspect Toaster/ToastItem/root layout only when store, display, or mounting changes.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Use toast success/error/warning/info/loading/promise helpers. Field validation stays inline and destructive impact copy stays inside its confirmation modal.
- Use stable ids for retry/update flows. Preserve duplicate suppression, counts, duration restart, and explicit ignoreDuplicateStack semantics.
- Mount the viewport through the root layout, not per route. Keep shared responsive placement, queue limits, insertion order, progress bars, and placement-aware ease-out motion.
- Preserve queued overflow notices, important-toast bypass, Clear existing versus Clear all behavior, and automatic promotion when slots open.
- Add actions only for requested or existing immediate recovery operations. Use toast-scoped solid/outline styling with the safe/forward action solid; actions cannot replace destructive confirmation.
- Keep titles contextual, copy short, and duration:null reserved for important persistent notices. Preserve existing variant/icon styling and avoid a third-party system.

## Read detail when needed

- [toast system](references/toast-system.md): Store/API, queue, placement, and action details.
- [integration contract](references/integration-contract.md): Detailed feedback and motion conventions.

## Done when

Async completion/failure, retries, and duplicate handling behave correctly for affected flows. Store/display changes also exercise the affected queue, timing, and placement cases. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
