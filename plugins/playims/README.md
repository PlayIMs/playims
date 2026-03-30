# PlayIMs Plugin

![PlayIMs Plugin Logo](./assets/playims-plugin-logo.svg)

The PlayIMs plugin is the repo-local Codex plugin for this project.

It bundles the project's PlayIMs-specific skills into one place so future UI and workflow work can follow the same patterns instead of re-deciding them each time.

## What This Plugin Includes

- `playims-style-builder`: dashboard page shells, layout patterns, forms, action bars, and shared visual conventions
- `playims-wizard-builder`: shared PlayIMs wizard and modal flows
- `playims-data-table-builder`: offerings-style shared table work with `DataTable.svelte`
- `playims-offerings-table-builder`: offerings-board-specific grouped table and section patterns
- `playims-listbox-dropdown-builder`: shared dashboard dropdown/select behavior
- `playims-search-bar-builder`: shared search input patterns
- `playims-info-popover-builder`: helper/info popover patterns
- `playims-hover-tooltip-builder`: hover/focus tooltip patterns
- `playims-toast-builder`: shared toast feedback patterns

## When To Use It

Use this plugin whenever the task should match existing PlayIMs product conventions, especially for:

- new dashboard pages
- new wizards or modals
- offerings-style tables
- shared dropdown/search/tooltip/popover work
- toast-first feedback flows
- refactors that should align older UI with current PlayIMs patterns

## Example Prompts

```text
Use $playims-wizard-builder to create a new PlayIMs wizard for creating a facility.
Match the existing dashboard wizard style, include inline validation, and use shared toasts on save.
```

```text
Use $playims-style-builder and $playims-listbox-dropdown-builder to restyle this dashboard page so it matches current PlayIMs conventions.
```

```text
Use $playims-data-table-builder to convert this list into an offerings-style table with shared row actions.
```

## How To Think About It

Technically, the plugin is the container and the skills are the task-specific instruction sets inside it.

In plain English, the plugin is the toolbox and the skills are the tools.

## Plugin Layout

```text
plugins/playims/
|-- .codex-plugin/plugin.json
|-- assets/
|   |-- playims-plugin-icon.svg
|   `-- playims-plugin-logo.svg
|-- README.md
`-- skills/
    |-- playims-style-builder/
    |-- playims-wizard-builder/
    |-- playims-data-table-builder/
    `-- ...
```
