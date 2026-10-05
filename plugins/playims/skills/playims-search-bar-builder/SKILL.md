---
name: playims-search-bar-builder
description: Build or migrate PlayIMs free-text filtering controls with SearchInput, including compact wizard and dropdown variants. Use for input UI rather than global search-palette logic.
---

# PlayIMs Search Bar Builder

Reuse SearchInput for dashboard text-filter fields and embedded searches.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `src/lib/components/SearchInput.svelte` and the active consumer; compare the offerings search row only for visual parity.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Preserve search scope, filtering, pagination/reset side effects, disabled/loading states, and existing input attributes such as data-lpignore.
- Use the existing component's props/class hooks for width, icon, placeholder, and compact variants rather than rebuilding input/icon/clear markup.
- Keep square shared control chrome, left search icon, and a trailing clear affordance only when text exists. Use context-specific accessible labels.
- Searchable dropdown panels use SearchInput too. Extend the shared input for required focus/keyboard behavior instead of bypassing it.
- Input UI and global search-palette orchestration are different responsibilities; confirm the active entry point before changing filtering or palette behavior.

## Read detail when needed

- [search bar recipes](references/search-bar-recipes.md): Default and compact prop recipes.
- [integration contract](references/integration-contract.md): Migration behavior and styling details.

## Done when

Typing and clearing preserve search/reset behavior, labels and disabled states, and control alignment. Run the repository gates appropriate to styling versus filtering logic. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
