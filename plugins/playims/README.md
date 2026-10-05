# PlayIMs Plugin

![PlayIMs Plugin Logo](./assets/playims-plugin-logo.svg)

The PlayIMs plugin is the repo-local Codex plugin for this project.

Version 0.3.0 uses concise entrypoints for all ten skills, with detailed component contracts
and recipes in references that load only when needed. Descriptions distinguish overlapping
skills (table versus board, tooltip versus popover, input versus search palette). Every skill
has concrete completion criteria and follows the workspace `AGENTS.md` testing tiers.
These are workflow improvements, not a measured model-specific performance claim.

Edit this repository source rather than an installed cache. Reload/reinstall through the host's
supported plugin workflow from the verified marketplace source to activate changes. The cached
plugin shown in a session may still be the previous version until that refresh occurs.

## Source and local activation

The repository's `.agents/plugins/marketplace.json` defines `playims-local` and points at
`plugins/playims`. This is the maintained source. The root `plugin.json` is the portable
Agent Plugins manifest; `.codex-plugin/plugin.json` remains as the Codex compatibility manifest.
Keep their identity, version, presentation, and prompt values synchronized. Packaging support
does not prove compatibility with every host; verify installation in each intended host.

From a terminal where the Codex CLI is available:

```powershell
codex plugin marketplace add C:/Users/Jake/Documents/Projects/playims
codex plugin add playims@playims-local
codex plugin list --marketplace playims-local
```

The installed CLI's `--help` is authoritative if its commands differ. Refresh the skill list
in the app or start a new turn/chat to use the installed update. Never edit the cache directly.
The old personal plugin copy and standalone wizard skill are not the repository source.

## Why this structure

The [official skills guide](https://developers.openai.com/plugins/build/skills) explains
that descriptions control discovery and references provide optional detail. These skills
already use normal filesystem/editor tools; an MCP server is useful only when a concrete
integration needs live data or controlled actions. Adding a server does not improve component
instructions by itself.

[Reasoning effort](https://developers.openai.com/api/docs/guides/reasoning) is a runtime/API
setting. These skills do not claim to change it with prose or invent metadata fields for it.
They provide concrete outcomes, preserved contracts, and verification evidence instead.

For work spanning multiple sessions, save a short handoff when continuity is needed: current
objective, changed files, checks and their results, unresolved decisions, and next action.
Include a date/commit reference and treat it as a pointer to current code, not an authoritative
transcript. Avoid automatic full-chat dumps or per-task summary files when Git and a short
message already provide enough context.

## Maintenance checks

- Validate all skill frontmatter and ensure folder names match skill names.
- Check Markdown reference links and exact repository source paths.
- Check both manifests, their referenced assets, and their synchronized metadata.
- Review realistic prompts: a spacing change should stay relaxed; filtering or wizard validation
  needs full TDD; a table task should not load rich-editor or unrelated wizard references.
- Package-only edits need package checks. Application changes follow `AGENTS.md`; do not claim
  a browser check based on unit tests or spend an app build on a wording-only skill edit.

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
- `playims-tiptap-rich-editor-builder`: TipTap v3 editor architecture, lifecycle, persistence, and integration patterns for PlayIMs

## When To Use It

Use this plugin whenever the task should match existing PlayIMs product conventions, especially for:

- new dashboard pages
- new wizards or modals
- offerings-style tables
- shared dropdown/search/tooltip/popover work
- rich-text editor work that should follow official TipTap patterns and PlayIMs styling
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

```text
Use $playims-tiptap-rich-editor-builder and $playims-style-builder to build a Svelte 5 TipTap editor with PlayIMs styling and JSON-first persistence.
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
    |-- playims-tiptap-rich-editor-builder/
    |-- playims-wizard-builder/
    |-- playims-data-table-builder/
    `-- ...
```
