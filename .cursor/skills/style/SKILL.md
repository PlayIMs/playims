---
name: style
description: Defines the CSS framework, styling conventions, and design system for this project using TailwindCSS with a retro flat design aesthetic.
---

# Style Guide

This skill defines the styling standards, CSS framework usage, and design principles for the PlayIMs project.

## When to Use

- Use this skill when creating or modifying UI components, pages, or layouts
- Apply when selecting CSS classes, colors, typography, or spacing
- Reference when designing new dashboard screens or user interfaces
- Follow when implementing visual design elements or styling patterns

## Instructions

### CSS Framework

- **Always use TailwindCSS** for all CSS and styling in the project
- Follow best practices according to the latest TailwindCSS version
- Prefer utility classes over custom CSS when possible
- Use the project's custom color palette (primary, secondary, neutral, accent) defined in the theme system
- Use the custom components created for buttons, badges, form elements, etc. as seen in the usage examples in colors/+page.svelte.

### Design Aesthetic

- **Retro Flat Design**: Use a flat design style with no rounded edges
- Avoid border-radius, rounded corners, or curved elements
- Maintain consistent flat, geometric shapes throughout the interface
- Use sharp, clean edges for all UI elements
- Avoid clunky design elements
- The inner-most, nested child border should be thinner than the outer-most (parent) border.

### Color System

- Use the project's theme colors: `primary`, `secondary`, `neutral`, and `accent`
- **Primary**: Main brand color, used for dominant UI elements (~60% of design)
- **Secondary**: Supporting color for backgrounds and sidebars (~30% of design)
- **Neutral**: Background colors, borders, and neutral UI elements. Defaults to Tailwind zinc palette, but can be customized with light shades (white, beige, pastels)
- **Accent**: Call-to-action buttons, highlights, and attention-grabbing elements (~10% of design). Used on top of static surface backgrounds
- **Text Contrast on Neutral**: The neutral background is a light color (cream/beige). Always use very dark text (`text-neutral-950` or `text-neutral-900`) on neutral backgrounds to ensure readability. Never use `text-neutral-600` or lighter on neutral backgrounds.
- Follow existing color patterns found in the codebase
- Follow the usage examples found in `/src/routes/colors/+page.svelte`
- Maintain consistency with text colors, fonts, and sizes used elsewhere in the project
- Reference the color theme system defined in `$lib/theme.ts` for dynamic color generation
- Use `getReadableTextColor(backgroundColorHex, themeColorPalette)` to automatically select accessible text colors based on background luminance
- Accent colors are validated for WCAG contrast and saturation - warnings are shown if issues are detected

### Typography

- Follow existing text color patterns
- Maintain consistent font sizes and weights
- Use the project's established typography scale

### Icons

- **Use Tabler Icons** (`@tabler/icons-svelte`) for all icon needs throughout the project
- Import icons as Svelte components from `@tabler/icons-svelte`
- Use icons consistently and only where they add clarity or improve usability
- Icons should be appropriately sized (typically `w-5 h-5` or `w-4 h-4` for navigation, `w-6 h-6` for larger contexts)
- Match icon style to the context (e.g., navigation icons, action icons, status indicators)
- Ensure icons have proper spacing from adjacent text (use `gap-2` or `gap-3` in flex containers)

### Dashboard Design

- The project consists primarily of dashboard screens
- Design screens to be **user-friendly and intuitive**
- Prioritize clarity and ease of use
- For complex features or non-intuitive interactions, provide:
  - Clear instructions
  - Information icons (ℹ️) that users can click for help
  - Tooltips or helper text where appropriate

### Svelte Runes (Svelte 5)

- **Always use Svelte 5 runes** for reactive state management
- Use `$state()` for component state: `let count = $state(0)`
- Use `$derived()` for computed values: `let doubled = $derived(count * 2)`
- Use `$effect()` for side effects: `$effect(() => { console.log(count); })`
- Use `$props()` for component props: `let { name, age } = $props()`
- **Dynamic Components**: In runes mode, components are dynamic by default. Use component references directly as tags instead of `<svelte:component>`
  - Example: `<item.icon class="w-5 h-5" />` instead of `<svelte:component this={item.icon} class="w-5 h-5" />`
  - Component references stored in variables can be used directly: `const Icon = IconUser; <Icon />`
- **Event Handlers**: Use interactive elements (buttons, links) for mouse/keyboard events. Avoid attaching event listeners to non-interactive elements like `<div>`. If you must use a non-interactive element with a click handler:
  - Add `role="button"` and `tabindex="0"` for accessibility
  - Add `onkeydown` handler that triggers on Enter/Space keys: `onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handler(); }}`
  - Prefer using `<button type="button">` with styling (`border-0`, `bg-transparent`, `p-0`) instead

### HTML Structure Rules

- **Never nest `<form>` elements**: HTML does not allow a `<form>` inside another `<form>`. If you need to trigger a different action from within a form (e.g., a "Restore" button inside an edit form's error message), use a `<button type="button">` with an `onclick` handler that calls a JavaScript function using `fetch` to submit the action.
  - Example: Instead of nesting forms, use `onclick={() => submitAction('actionName', { key: value })}`
- **Modal backdrop accessibility**: When using a `<div>` as a clickable modal backdrop overlay:
  - Add `role="button"` and `tabindex="0"` for accessibility
  - Add `onkeydown` handler for keyboard support (at minimum handle Escape key to close)
  - Example: `onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}`
- **Inner modal content**: Use `role="presentation"` and `onclick={(e) => e.stopPropagation()}` to prevent clicks inside the modal from closing it

### Best Practices

- Maintain visual consistency across all screens
- Ensure proper spacing and alignment using Tailwind's spacing utilities
- Use semantic HTML with appropriate Tailwind classes
- Follow accessibility guidelines (see `html-accessibility.md` rule)
- Keep designs clean and uncluttered
- Prioritize functionality and usability over decorative elements
