# Editor QA

AGENTS.md owns testing tiers and final gates. Use full TDD for editor behavior or persistence changes; choose only runtime cases affected by the request.

## Application changes

- Mount, type, select, and format content in the actual editor route. Check toolbar state after transactions and selection changes.
- Verify the affected keyboard shortcuts, undo/redo, and focus restoration.
- Check empty content, representative existing content, and read-only display when touched.
- For persistence changes, save/reload representative JSON and required HTML/text derivations without losing supported marks/nodes.
- For lifecycle changes, navigate away and remount without leaked listeners, duplicate editors, or SSR/hydration errors.
- Test requested image/table/paste behavior only when those modules change.
- Run the repository test/type gates; run a production build when shared editor dependencies or SSR integration change. Report browser results separately.

## Skill-package changes

Validate frontmatter, discriminating descriptions, relative links, source paths, and preserved contracts. If the local skill-creator validator is available, use it. Preserve policy and dependency fields when editing agents/openai.yaml; do not regenerate the file merely because one string changed.

Representative review prompts:

- Add a bold button to the current communications editor: preserve lifecycle and storage, use commands, and verify selection/toolbar state.
- Add table support to an editor: inspect installed APIs, load the advanced module reference, preserve existing content, and verify editing/round-trip behavior.

These are review scenarios, not automatic authorization to alter an app or spawn agents.

## Activate a package update

Edit the marketplace's owning source and use the host's supported plugin install/reload command. Verify the loaded version and skill discovery. Never copy directly into the installed plugin cache. A changed package cannot retroactively replace instructions already read in an active turn.
