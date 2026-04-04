# Advanced Modules

Use this reference only when the editor feature genuinely needs more than a core formatted-text surface.

## Markdown

Treat Markdown as optional and beta.

Useful cases:

- import/export Markdown
- Markdown persistence for a specific workflow
- live Markdown preview
- server-side Markdown rendering

Defaults:

- do not make Markdown the default PlayIMs editor contract
- do not bundle pasted-Markdown detection, custom tokenizers, or preview behavior unless the feature explicitly needs them

## Long-document handling

TipTap supports very large documents, but that does not mean every editor should eagerly load everything at once.

For large content:

- consider progressive loading
- avoid unnecessary whole-document re-serialization on every keystroke
- keep preview/update flows narrow and intentional

## Images

Images are supported, but image capability alone does not define:

- upload architecture
- storage provider
- validation rules
- aspect-ratio policy
- resize UX

Make those app-level decisions intentionally before adding image support.

## Tables

Tables are supported, but table capability alone does not define:

- resize behavior
- merge/split behavior
- keyboard affordances
- toolbar/menu UX

Keep table support opt-in and feature-specific.

## Formatting bundles

Default bundle:

- minimal `StarterKit`-style baseline plus only the marks/nodes the feature needs

Opt-in bundles:

- Markdown support
- image support
- table support
- custom node views
- mention/autocomplete systems

Prefer layering instead of an “everything enabled” preset.

## Node position helpers and resizable node views

These are powerful but advanced.

Use them when the feature needs:

- contextual block tools
- block-aware menus
- embedded media that users can resize
- node-specific editing chrome

Keep the default skill path simpler when those features are not required.

## What stays out of the main skill body

- pasted-Markdown heuristics
- custom Markdown tokenizers
- preview pipeline details
- chunk-loading implementations
- upload/storage specifics for images
- table-specific UX policy
- complex node-position traversals
- resizable node-view persistence details

## Official docs covered

- Markdown examples: https://tiptap.dev/docs/editor/markdown/examples
- Long text performance: https://tiptap.dev/docs/examples/basics/long-texts
- Images: https://tiptap.dev/docs/examples/basics/images
- Tables: https://tiptap.dev/docs/examples/basics/tables
- Formatting: https://tiptap.dev/docs/examples/basics/formatting
