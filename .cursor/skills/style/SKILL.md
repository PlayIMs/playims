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

### Design Aesthetic

- **Retro Flat Design**: Use a flat design style with no rounded edges
- Avoid border-radius, rounded corners, or curved elements
- Maintain consistent flat, geometric shapes throughout the interface
- Use sharp, clean edges for all UI elements

### Color System

- Use the project's theme colors: `primary`, `secondary`, `neutral`, and `accent`
- **Primary**: Main brand color, used for dominant UI elements (~60% of design)
- **Secondary**: Supporting color for backgrounds and sidebars (~30% of design)
- **Neutral**: Background colors, borders, and neutral UI elements. Defaults to Tailwind zinc palette, but can be customized with light shades (white, beige, pastels)
- **Accent**: Call-to-action buttons, highlights, and attention-grabbing elements (~10% of design). Used on top of static surface backgrounds
- Follow existing color patterns found in the codebase
- Maintain consistency with text colors, fonts, and sizes used elsewhere in the project
- Reference the color theme system defined in `$lib/theme.ts` for dynamic color generation
- Use `getReadableTextColor(backgroundColorHex, themeColorPalette)` to automatically select accessible text colors based on background luminance
- Accent colors are validated for WCAG contrast and saturation - warnings are shown if issues are detected

### Typography

- Follow existing text color patterns
- Maintain consistent font sizes and weights
- Use the project's established typography scale

### Dashboard Design

- The project consists primarily of dashboard screens
- Design screens to be **user-friendly and intuitive**
- Prioritize clarity and ease of use
- For complex features or non-intuitive interactions, provide:
  - Clear instructions
  - Information icons (ℹ️) that users can click for help
  - Tooltips or helper text where appropriate

### Best Practices

- Maintain visual consistency across all screens
- Ensure proper spacing and alignment using Tailwind's spacing utilities
- Use semantic HTML with appropriate Tailwind classes
- Follow accessibility guidelines (see `html-accessibility.md` rule)
- Keep designs clean and uncluttered
- Prioritize functionality and usability over decorative elements
