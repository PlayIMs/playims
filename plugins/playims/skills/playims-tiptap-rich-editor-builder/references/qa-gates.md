# QA Gates

All gates in this file are required for `playims-tiptap-rich-editor-builder`.

## 1) Skill Package Integrity

Run from repo root:

```powershell
python "C:\Users\Jake\.codex\skills\.system\skill-creator\scripts\quick_validate.py" "plugins/playims/skills/playims-tiptap-rich-editor-builder"
```

If `agents/openai.yaml` was edited manually, regenerate it deterministically:

```powershell
python "C:\Users\Jake\.codex\skills\.system\skill-creator\scripts\generate_openai_yaml.py" "plugins/playims/skills/playims-tiptap-rich-editor-builder" --interface "display_name=PlayIMs TipTap Rich Editor Builder" --interface "short_description=Build TipTap editors in Svelte 5 with PlayIMs styling" --interface 'default_prompt=Use $playims-tiptap-rich-editor-builder and $playims-style-builder to build or refactor a Svelte 5 TipTap editor that follows official TipTap patterns and PlayIMs styling.'
```

Verify reference files exist:

```powershell
Get-ChildItem "plugins/playims/skills/playims-tiptap-rich-editor-builder/references/*.md" | Select-Object -ExpandProperty Name
```

Verify `SKILL.md` links all required references:

```powershell
Select-String -Path "plugins/playims/skills/playims-tiptap-rich-editor-builder/SKILL.md" -Pattern "core-svelte-and-styling.md|architecture-schema-and-persistence.md|api-events-and-rules.md|advanced-modules.md|qa-gates.md"
```

## 2) Forward-Test Prompts

Use fresh subagents with prompts like:

```text
Use $playims-tiptap-rich-editor-builder and $playims-style-builder to build a PlayIMs Svelte 5 rich-text editor with JSON persistence, a headless toolbar, and PlayIMs styling.
```

```text
Use $playims-tiptap-rich-editor-builder and $playims-style-builder to refactor an existing PlayIMs editor to use direct TipTap lifecycle, extension-first logic, and optional advanced modules only when requested.
```

Success criteria:

- direct TipTap integration is chosen instead of a wrapper-first approach
- JSON-first persistence is chosen by default
- styling is routed through PlayIMs styling guidance instead of a new design system
- advanced modules stay opt-in instead of being bundled by default

## 3) Cache Mirror

After validation succeeds, mirror the repo skill folder into the currently-loaded PlayIMs plugin cache so the skill is immediately available in the live Codex session.

Current cache target:

```text
C:\Users\Jake\.codex\plugins\cache\playims-local\playims\local\skills\playims-tiptap-rich-editor-builder
```
