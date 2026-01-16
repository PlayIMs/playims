# HTML & Svelte Accessibility Standards

This rule ensures all generated HTML and Svelte code follows WCAG accessibility guidelines and Svelte's accessibility best practices. Apply these standards by default when generating any HTML/Svelte markup.

## Button & Link Accessibility

### Buttons Without Visible Text

**ALWAYS** add `aria-label` to buttons that don't contain text content:

```svelte
<!-- ❌ BAD -->
<button onclick={closeModal}>×</button>
<button class="color-picker-btn" style="background-color: {color}"></button>

<!-- ✅ GOOD -->
<button onclick={closeModal} aria-label="Close modal">×</button>
<button class="color-picker-btn" style="background-color: {color}" aria-label="Open color picker"
></button>
```

## Interactive Elements (Clickable Divs)

### Divs with Click Handlers

**NEVER** use `<div>` with `onclick` without proper accessibility attributes. Use one of these approaches:

**Option 1: Make it a proper button (PREFERRED)**

```svelte
<!-- ❌ BAD -->
<div onclick={handleClick} class="clickable-card">Content</div>

<!-- ✅ GOOD -->
<button onclick={handleClick} class="clickable-card" type="button"> Content </button>
```

**Option 2: If div is required, add keyboard support and ARIA**

```svelte
<!-- ✅ GOOD -->
<div
	onclick={handleClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}}
	role="button"
	tabindex="0"
	aria-label="Descriptive label for screen readers"
>
	Content
</div>
```

### Modal Backdrop Divs (Event Propagation Only)

For divs that only stop event propagation (not interactive themselves), use `role="presentation"`:

```svelte
<!-- ✅ GOOD -->
<div
	class="modal-content"
	onclick={(e) => e.stopPropagation()}
	onkeydown={(e) => e.stopPropagation()}
	role="presentation"
>
	<!-- Modal content -->
</div>
```

## Form Label Association

### Labels Must Be Associated with Controls

**ALWAYS** associate labels with form inputs using `for` and `id` attributes:

```svelte
<!-- ❌ BAD -->
<label class="block mb-2">Email</label>
<input type="email" />

<!-- ✅ GOOD -->
<label for="email-input" class="block mb-2">Email</label>
<input id="email-input" type="email" />
```

**For Svelte, you can also wrap the input:**

```svelte
<!-- ✅ GOOD (Alternative) -->
<label class="block mb-2">
	Email
	<input type="email" />
</label>
```

## Autofocus in Svelte

### Never Use HTML `autofocus` Attribute

**ALWAYS** use a Svelte action instead of the HTML `autofocus` attribute:

```svelte
<script>
	function autofocus(node: HTMLElement) {
		if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
			node.focus();
		}
		return {};
	}
</script>

<!-- ❌ BAD -->
<input type="text" autofocus />

<!-- ✅ GOOD -->
<input type="text" use:autofocus />
```

## Canvas Elements

### Canvas with Click Handlers

**ALWAYS** add keyboard support and ARIA attributes to interactive canvas elements:

```svelte
<!-- ✅ GOOD -->
<canvas
	bind:this={canvasElement}
	onclick={handleClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			// Handle keyboard interaction
		}
	}}
	role="button"
	tabindex="0"
	aria-label="Descriptive label explaining what the canvas does"
></canvas>
```

## Modal Accessibility

### Modal Overlays

**ALWAYS** add keyboard support (Escape key) and proper ARIA to modal overlays:

```svelte
<!-- ✅ GOOD -->
<div
	class="fixed inset-0 bg-black/50 z-50"
	onclick={closeModal}
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			closeModal();
		}
	}}
	role="button"
	tabindex="0"
	aria-label="Close modal"
>
	<div
		class="modal-content"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="presentation"
	>
		<!-- Modal content -->
	</div>
</div>
```

## Keyboard Navigation

### All Interactive Elements Must Support Keyboard

**ALWAYS** ensure any element with mouse handlers also supports keyboard:

- Add `onkeydown` handler for Enter and Space keys
- Add `role="button"` for divs acting as buttons
- Add `tabindex="0"` to make elements focusable
- Prevent default behavior when handling keyboard events

## Summary Checklist

When generating HTML/Svelte code, verify:

- [ ] All buttons without text have `aria-label`
- [ ] All clickable divs have `onkeydown`, `role="button"`, `tabindex="0"`, and `aria-label`
- [ ] All form labels are associated with inputs using `for`/`id` or wrapping
- [ ] No HTML `autofocus` attribute is used (use Svelte action instead)
- [ ] Modal backdrops that only stop propagation have `role="presentation"`
- [ ] All interactive elements support keyboard navigation
- [ ] Canvas elements with interactions have proper ARIA and keyboard support

## References

- [Svelte Accessibility Warnings](https://svelte.dev/docs/accessibility-warnings)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
