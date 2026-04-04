# API, Events, And Rules

Use this reference when wiring toolbar behavior, editor events, runtime configuration, and advanced command logic.

## Core editor surfaces

Key `Editor` setup surfaces:

- `element`
- `extensions`
- `content`
- `editable`
- `autofocus`
- `editorProps`
- `parseOptions`

Common query/method surfaces:

- `editor.isActive(...)`
- `editor.getAttributes(...)`
- `editor.isEditable`
- `editor.isEmpty`
- `editor.isFocused`
- `editor.getHTML()`
- `editor.getJSON()`
- `editor.getText(...)`
- `editor.setEditable(...)`
- `editor.setOptions(...)`
- `editor.registerPlugin(...)`
- `editor.unregisterPlugin(...)`

## Command patterns

- Base mutation surface: `editor.commands.<command>()`
- Standard toolbar pattern: `editor.chain().focus()...run()`
- Capability probe: `editor.can()`

Why `.focus()` matters:

- clicking a toolbar button usually moves focus away from the editor
- most formatting commands should restore focus before mutating

## Chaining

- Chained commands execute as one transaction.
- Prefer chaining when one user action should behave as one editor mutation.

For custom commands:

- use the provided `chain()` helper inside the command, not `editor.chain()`
- return `true` or `false`
- respect `dispatch` when working at raw-transaction level so `.can()` works correctly
- map positions with `tr.mapping.map(...)` if earlier steps changed the document

## Events

Common events:

- `beforeCreate`
- `create`
- `update`
- `selectionUpdate`
- `transaction`
- `focus`
- `blur`
- `destroy`
- `paste`
- `drop`
- `delete`
- `contentError`

How to use them:

- use `update` for content persistence
- use `selectionUpdate` when UI should react to cursor/selection changes
- use `transaction` when the component must stay in sync with any editor-state change
- use `contentError` to catch schema/content mismatches

Listener placement options:

- editor config callbacks for component-level setup
- `editor.on(...)` / `editor.off(...)` for runtime component listeners
- extension hooks for reusable behavior

## Input rules and paste rules

- These shape automatic typing/paste behavior.
- They can be disabled completely or whitelisted to a controlled subset.

Use intentional defaults:

- leave them on only when the resulting shortcuts/conversions are desirable
- whitelist them when product behavior should stay narrow and predictable

## Advanced APIs to isolate

Keep these out of the main skill body and treat them as opt-in advanced surfaces:

- `NodePos` / node-position helpers
- `ResizableNodeView`
- lower-level utility families such as static rendering or suggestion systems

Use them only when the feature genuinely needs:

- block-aware positioning
- resizable media nodes
- autocomplete / mention behavior
- server-side content transforms

## Anti-patterns

- Using `editorProps` as the primary app-state integration layer when normal TipTap events/commands would do.
- Blurring methods and commands together.
- Writing chained custom commands with stale positions.
- Persisting resize attributes continuously during drag instead of committing at the end.
- Ignoring `contentError`.

## Official docs covered

- Editor instance: https://tiptap.dev/docs/editor/api/editor
- Commands: https://tiptap.dev/docs/editor/api/commands
- Utilities: https://tiptap.dev/docs/editor/api/utilities
- Node positions: https://tiptap.dev/docs/editor/api/node-positions
- Resizable node views: https://tiptap.dev/docs/editor/api/resizable-nodeviews
- Events: https://tiptap.dev/docs/editor/api/events
- Input rules: https://tiptap.dev/docs/editor/api/input-rules
- Paste rules: https://tiptap.dev/docs/editor/api/paste-rules
