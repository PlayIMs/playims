# Core Svelte And Styling

Use this reference when building the editor component and its styling contract.

## Svelte 5 lifecycle

- Create TipTap on the client only.
- Bind a real DOM element with `bind:this`.
- Destroy the editor instance on teardown.
- Keep the editor in reactive state and refresh that state on `transaction` / `onTransaction` so Svelte re-renders toolbar state that depends on `editor.isActive(...)` or selection.

Why this matters:

- TipTap binds against a real DOM node.
- Svelte 5 toolbar state can become stale if the editor reference never changes after transactions.

## Component shape

- Prefer a dedicated rich-editor component that the route mounts and owns through props/callbacks.
- Keep persistence ownership in the parent route/component.
- Keep the editor component focused on:
  - editor setup
  - toolbar/menu actions
  - content events
  - editability and read-only behavior

## Headless UI contract

- TipTap is headless-first.
- PlayIMs owns:
  - toolbar buttons
  - dropdowns
  - tooltips
  - link dialogs
  - layout
  - empty/read-only chrome

Do not expect TipTap core to render finished UI or polished styles for you.

## Styling guidance

- Scope editable-surface styles to `.tiptap`.
- Prefer shared/global CSS for rich-text content styling.
- In Tailwind projects, prefer global `.tiptap` rules with `@apply` or shared classes instead of pushing classes through every extension.
- Use `editorProps.attributes.class` or stable semantic node hooks when you need classes on the editor root.
- Use extension `HTMLAttributes` only when semantic output genuinely needs stable node-level hooks.

## Editor vs display styling

- The live editor usually has a `.tiptap` wrapper.
- Saved or previewed HTML rendered elsewhere may not.
- If the app renders saved content outside the editor, give that display surface its own styling wrapper or shared content styles.

## PlayIMs defaults

- Route visual choices through `$playims-style-builder`.
- Use `src/app.css` as the visual source of truth for shared editor chrome.
- Keep the editor shell square/flat unless existing PlayIMs patterns justify an exception.
- Reuse shared controls when the toolbar needs dropdowns, tooltips, or helper popovers.

## Anti-patterns

- Initializing TipTap before the DOM exists.
- Forgetting `editor.destroy()` on teardown.
- Leaving the editor reference static while expecting Svelte 5 active-state UI to update automatically.
- Treating `.tiptap` styles as route-local one-offs.
- Using CSS Modules without `:global(.tiptap)` when targeting editor output.

## Official docs covered

- Svelte install: https://tiptap.dev/docs/editor/getting-started/install/svelte
- Style editor: https://tiptap.dev/docs/editor/getting-started/style-editor
- Core concepts introduction: https://tiptap.dev/docs/editor/core-concepts/introduction
- Default text editor example: https://tiptap.dev/docs/examples/basics/default-text-editor
- Formatting example: https://tiptap.dev/docs/examples/basics/formatting
