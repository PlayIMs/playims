---
name: playims-style-builder
description: Build or refactor PlayIMs dashboard pages and wizard UI with codebase-aligned Tailwind recipes, theme token discipline, shared component conventions, and toast-first transient feedback. Use when adding or modifying src/routes/dashboard/** layouts, forms, action bars, feedback states, and destructive flows so new UI matches offerings, toasts, and shared wizard patterns.
---


# PlayIMs Style Builder

Build dashboard UI consistent with the active app. The offerings route establishes the module layout; `src/app.css` owns shared primitives. Preserve the requested scope and existing behavior unless the user requests a change.

## Start with the affected surface

Read workspace `AGENTS.md` and choose its testing tier before editing. Pure styling and trivial prop plumbing use relaxed verification; conditions, state, validation, filtering, permissions, and data shaping require full TDD. Follow the repository test-comment standard.

Inspect the active route, the shared component being changed, and one matching live consumer. For a module page, inspect the offerings shell; for settings, inspect the shared settings layout. Avoid loading unrelated pages or every companion skill.

## Essential design constraints

- Use `dashboard-page-shell`, a full-width title/icon header, and a separately padded body. Place actions, counts, and filters below the title strip.
- Use shared theme-aware controls with secondary as the default family. Filled primary/secondary surfaces use contrast-aware foreground tokens.
- Keep square page chrome and neutral borders; match neighboring controls in height and border weight. Preserve existing scoped shape exceptions.
- Reuse `ListboxDropdown`, `SearchInput`, `InfoPopover`, `HoverTooltip`, and the shared toast API where those interactions apply.
- Use shared wizard primitives and route-local wrappers for creation flows. Preserve step validation, dirty-state confirmation, and keyboard behavior.
- Keep persistent field errors inline and transient feedback in toasts. Destructive confirmations use the existing custom modal pattern and typed confirmation for broad data-loss scope.
- Current component APIs and `src/app.css` override stale copied recipes. Do not change backend contracts merely to restyle UI.

## Read detail when needed

- [Dashboard layout recipes](references/dashboard-layout-recipes.md): module/page layout changes.
- [Style foundation](references/style-foundation.md): tokens, typography, borders, and shape decisions.
- [Class recipes](references/class-recipes.md): exact existing class combinations.
- [Forms and controls](references/forms-and-controls.md): labels and control alignment.
- [Wizard recipes](references/wizard-recipes.md): wizard framing and step layout; use the wizard skill for behavior changes.
- [Toast patterns](references/toast-patterns.md): transient notification changes.
- [Feedback and danger patterns](references/feedback-and-danger-patterns.md): inline errors and destructive flows.
- [Detailed dashboard contract](references/dashboard-style-contract.md): switcher specifics, exact shell recipes, or a parity dispute. Its source inventories are lookup maps, not mandatory bulk reads.
- [QA gates](references/qa-gates.md): select checks relevant to the change; repository testing tiers remain authoritative.
- [Migration map](references/migration-map.md): only for legacy style migration.

Load a companion skill only when modifying its component or behavior. Verify the affected surface at relevant viewport sizes and with keyboard/pointer interaction when browser access is available. Report actual checks and any unverified behavior; never infer a browser pass from a parser or unit test.
