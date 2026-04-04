---
name: playims-tiptap-rich-editor-builder
description: Build or refactor PlayIMs rich-text editors with direct TipTap v3 integration in Svelte 5, using official TipTap architecture and lifecycle patterns while routing visual decisions through `src/app.css` and `$playims-style-builder`. Use when creating a new editor, migrating a custom or wrapper-based editor, adding toolbar/formatting behavior, wiring persistence, or extending an existing PlayIMs TipTap surface.
---

# PlayIMs TipTap Rich Editor Builder

## Goal

Build TipTap editors the way the official docs intend: direct `Editor` integration, extension-first behavior, schema-driven content, JSON-first persistence, and PlayIMs-owned toolbar/layout/styling.

## Start Here

Read these first before editing a rich-text surface:

- `src/lib/components/communications/CommunicationRichEditor.svelte`
- `src/routes/dashboard/communications/+page.svelte`
- `src/app.css`
- `$playims-style-builder`

Load references only as needed:

- `references/core-svelte-and-styling.md`
- `references/architecture-schema-and-persistence.md`
- `references/api-events-and-rules.md`
- `references/advanced-modules.md`
- `references/qa-gates.md`

## Default Contract

- Use direct TipTap v3 `Editor` integration in Svelte 5 by default, not third-party wrapper packages.
- Create the editor only on the client, bind a real DOM element, and destroy the instance on teardown.
- Keep the editor instance in reactive state and refresh that state on `transaction` / `onTransaction` so toolbar and selection state stay in sync.
- Treat TipTap as headless. PlayIMs owns the toolbar, dropdowns, tooltips, layout, and editor chrome.
- Model behavior through extensions, commands, nodes, marks, schema, and events instead of DOM-driven editor logic.
- Use `editor.chain().focus()...run()` for toolbar actions and `editor.can()` / `editor.isActive()` for UI state.
- Store TipTap JSON as the canonical persistence format. HTML is secondary for rendering/export and legacy compatibility only.
- Use shared/global `.tiptap` styling with Tailwind and route visual choices through `$playims-style-builder`.
- Prefer extending existing TipTap extensions before creating new custom extensions.
- Use `@tiptap/pm` for lower-level ProseMirror access.
- Keep advanced modules opt-in: Markdown, images, tables, long-document handling, custom tokenizers, resizable node views, and node-position helpers.

## Required Workflow

1. Ground the existing editor surface.
   - Read the nearest live editor component and the parent route that owns persistence.
   - Identify the current stored formats, toolbar requirements, and read-only/display needs.
2. Choose the smallest extension set that satisfies the feature.
   - Start minimal.
   - Add only the nodes, marks, and behavior the use case requires.
3. Build the editor as a dedicated component.
   - Mount TipTap into a bound DOM element.
   - Keep the editor instance reactive enough for toolbar state and menu state.
4. Wire PlayIMs-owned controls around the editor.
   - Use shared controls where relevant, especially `$playims-listbox-dropdown-builder`, `$playims-hover-tooltip-builder`, and `$playims-info-popover-builder`.
   - Keep toolbar actions command-driven instead of DOM-driven.
5. Wire persistence intentionally.
   - Default to JSON as the canonical stored format.
   - Add HTML and plain-text derivations only when the surrounding app contract needs them.
6. Style the editable content through `.tiptap`.
   - Put base editor/content styling in shared or global CSS.
   - Use semantic extension `HTMLAttributes` only when there is a clear need for stable hooks.
7. Add optional modules only when the feature requires them.
   - Markdown is optional and beta.
   - Images, tables, node-position helpers, and resizable node views should stay opt-in.
8. Validate the skill or implementation with the checks in `references/qa-gates.md`.

## PlayIMs Defaults

- Default editor shape: a dedicated component mounted into a route, not an inline DOM experiment.
- Default toolbar ownership: PlayIMs-controlled UI with shared components, not TipTap-rendered chrome.
- Default styling: PlayIMs border, spacing, and typography rules from `src/app.css`, while content semantics and structure come from TipTap docs first.
- Default persistence:
  - canonical stored content: TipTap JSON
  - optional derived render format: HTML
  - optional derived plain text: text
- Default feature layering:
  - start minimal
  - add only the extensions the use case needs
  - leave Markdown, images, tables, and long-document strategies out unless the feature explicitly requires them

## Guardrails

- Do not build editor behavior with manual DOM manipulation when TipTap commands, events, or extensions should own it.
- Do not use HTML as the only persisted source of truth when JSON is available.
- Do not create custom extensions before checking whether an existing TipTap extension can be extended.
- Do not import raw `prosemirror-*` packages directly; use `@tiptap/pm`.
- Do not treat Markdown beta features as the default PlayIMs editor contract.
- Do not scatter one-off route-local content styling when `.tiptap` styling belongs in shared/global CSS.
- Do not assume the saved-content display view will automatically share `.tiptap` styles; style display output separately when needed.
- Do not leave all input/paste rules on by accident; enable or whitelist them intentionally if product behavior depends on them.
