# Architecture, Schema, And Persistence

Use this reference when deciding what the editor stores, what content it allows, and how features are composed.

## Core architecture

- TipTap is extension-first and built on ProseMirror.
- The practical model is:
  - extensions define capabilities
  - the extension set generates the schema
  - the schema and extensions define editor behavior

Treat extensions as the main unit of composition.

## Nodes and marks

- Nodes define structure: paragraph, heading, list item, blockquote, image, table, code block.
- Marks annotate text without changing structure: bold, italic, underline, link, color, highlight.

Use this distinction when planning the editor:

- If it changes document structure, think node.
- If it decorates text inline, think mark.

## Schema rules

- The schema is strict.
- Unsupported nodes, marks, or attributes are removed when content is parsed or loaded.
- The extension list effectively defines the schema.

Important schema implications:

- Pasted HTML is not automatically preserved.
- Arbitrary attributes do not survive unless extensions define them.
- Invalid content should be treated as a compatibility or migration problem, not as random editor behavior.

## Extension policy

- Start with the smallest useful extension set.
- Prefer extending official extensions before writing custom ones.
- Use `@tiptap/pm` when lower-level ProseMirror access is needed.

Create a custom extension only when:

- an official extension cannot be configured to do the job
- the behavior is reusable
- the schema or command surface genuinely needs to change

## Persistence defaults

- Canonical stored format: JSON from `editor.getJSON()`
- Optional derived format: HTML from `editor.getHTML()`
- Optional derived text: `editor.getText()`

Why JSON first:

- the docs recommend it
- it preserves structure more accurately
- it is easier to validate and transform
- it maps better to TipTap schema evolution than HTML-only storage

## Loading and compatibility

- Restore from JSON when available.
- Use HTML only as a secondary or legacy format.
- Consider `contentError` and content checks when schema mismatches are possible.

If invalid content appears:

- treat it as a schema mismatch
- check the extension set
- check stored legacy content shape
- do not silently assume the DOM is wrong

## Keyboard shortcuts

- Most shortcuts come from extensions.
- Use built-in defaults unless product behavior needs a real override.
- Override shortcuts by extending the relevant extension and implementing `addKeyboardShortcuts()`.
- Use `Mod` so one shortcut works across macOS and Windows/Linux.

## PlayIMs defaults

- Keep persistence route-owned.
- Default to JSON-first even when the surrounding route still keeps HTML/text derivatives.
- Keep advanced schema additions opt-in.
- Do not make Markdown or pasted-Markdown behaviors part of the default contract.

## Anti-patterns

- HTML-only persistence.
- Schema-unaware paste/load assumptions.
- Raw `prosemirror-*` imports.
- Writing many custom extensions before checking configuration or extension inheritance.
- Treating keyboard shortcuts as a separate global layer instead of extension behavior.

## Official docs covered

- Extensions: https://tiptap.dev/docs/editor/core-concepts/extensions
- Nodes and marks: https://tiptap.dev/docs/editor/core-concepts/nodes-and-marks
- Schema: https://tiptap.dev/docs/editor/core-concepts/schema
- Keyboard shortcuts: https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts
- Persistence: https://tiptap.dev/docs/editor/core-concepts/persistence
- ProseMirror: https://tiptap.dev/docs/editor/core-concepts/prosemirror
