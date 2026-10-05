---
name: playims-tiptap-rich-editor-builder
description: Build or extend PlayIMs TipTap v3 editors in Svelte 5 with direct lifecycle integration, command-driven toolbars, JSON persistence, and shared UI controls.
---

# PlayIMs TipTap Rich Editor Builder

Implement editor behavior through TipTap extensions/commands while PlayIMs owns the UI and styling.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `src/lib/components/communications/CommunicationRichEditor.svelte`, its active persistence owner, and package.json for installed versions.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Create a direct Editor only on the client, bind its DOM element, and destroy it on teardown. Keep instance/transaction state reactive so selection and toolbar state stay synchronized.
- Use chain().focus()...run(), can(), and isActive() for toolbar actions/state; use extensions, nodes, marks, schema, and events rather than manual DOM edits.
- Default to canonical TipTap JSON, with HTML/text derived when existing contracts require them. Preserve existing stored formats during scoped changes; a format migration needs its own validated plan.
- Keep editor styles shared through .tiptap and app.css; style saved-content display intentionally. Reuse shared toolbar controls and scope the style skill to visual work.
- Use the smallest extension set needed; extend existing extensions first and import low-level ProseMirror through @tiptap/pm.
- Images, tables, Markdown, node views, input/paste rules, and long-document strategies are opt-in. Verify current official APIs when adding version-sensitive functionality.

## Read detail when needed

- [core svelte and styling](references/core-svelte-and-styling.md): Mount/lifecycle and visual integration.
- [architecture schema and persistence](references/architecture-schema-and-persistence.md): Schema or saved-format changes.
- [api events and rules](references/api-events-and-rules.md): Toolbar commands, events, input/paste rules.
- [advanced modules](references/advanced-modules.md): Only for requested images/tables/Markdown/custom nodes.
- [integration contract](references/integration-contract.md): Detailed existing integration conventions.
- [qa gates](references/qa-gates.md): Select affected editor/runtime/persistence checks.

## Done when

Affected typing, selection, formatting, toolbar state, and teardown work; persistence changes round-trip representative content. Report runtime checks separately from parser/unit checks. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
