/**
 * Universal Svelte actions for common UI interactions
 */

/**
 * Action to update select arrow color dynamically and handle arrow flip on open/close
 * Automatically detects the color variant from the select's class and updates the arrow accordingly
 */
export function selectArrow(node: HTMLSelectElement) {
	// Track the actual open state
	let isOpen = false;
	let pendingClose = false;

	function updateArrow() {
		const computedStyle = getComputedStyle(node);
		const colorVar = node.classList.contains('select-primary')
			? '--color-primary-700'
			: node.classList.contains('select-secondary')
				? '--color-secondary-700'
				: '--color-accent-700';
		let arrowColor = computedStyle.getPropertyValue(colorVar).trim();
		// Ensure color has # prefix
		if (!arrowColor.startsWith('#')) {
			arrowColor = `#${arrowColor}`;
		}
		// Arrow points up when dropdown is open, down when closed
		const path = isOpen ? 'M6 3L1 8h10z' : 'M6 9L1 4h10z';
		// URL encode the color (including the #)
		const encodedColor = encodeURIComponent(arrowColor);
		const svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${encodedColor}' d='${path}'/%3E%3C/svg%3E`;
		node.style.backgroundImage = `url("${svg}")`;
	}

	function handleFocus() {
		// If we have a pending close, don't reopen (user clicked to close)
		if (pendingClose) {
			return;
		}
		isOpen = true;
		updateArrow();
	}

	function handleBlur() {
		pendingClose = false;
		isOpen = false;
		updateArrow();
	}

	function handleMouseDown(event: MouseEvent) {
		// Track if select was focused before this click
		const wasFocused = document.activeElement === node;
		
		if (pendingClose) {
			// We had a pending close, this click is to reopen
			pendingClose = false;
			// If it's already focused, manually set to open (focus event won't fire)
			if (wasFocused) {
				isOpen = true;
				updateArrow();
			}
			// If it wasn't focused, the focus handler will set it to open
			return;
		}
		
		if (wasFocused && isOpen) {
			// If it was already focused and open, clicking again closes the dropdown
			pendingClose = true;
			isOpen = false;
			updateArrow();
		}
		// If it wasn't focused, the focus handler will set it to open
	}

	function handleChange() {
		// When selection changes, dropdown closes
		pendingClose = false;
		isOpen = false;
		updateArrow();
	}

	// Handle clicks outside to close
	function handleDocumentClick(event: MouseEvent) {
		// If clicking outside the select, it's closing
		if (!node.contains(event.target as Node)) {
			pendingClose = false;
			setTimeout(() => {
				if (document.activeElement !== node) {
					isOpen = false;
					updateArrow();
				}
			}, 10);
		}
	}

	// Initial update
	updateArrow();

	// Event listeners
	node.addEventListener('focus', handleFocus);
	node.addEventListener('blur', handleBlur);
	node.addEventListener('mousedown', handleMouseDown);
	node.addEventListener('change', handleChange);
	document.addEventListener('mousedown', handleDocumentClick);

	// Watch for theme changes on document root
	const observer = new MutationObserver(() => {
		// Small delay to ensure CSS variables are updated
		setTimeout(updateArrow, 10);
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['style']
	});

	return {
		update() {
			updateArrow();
		},
		destroy() {
			pendingClose = false;
			node.removeEventListener('focus', handleFocus);
			node.removeEventListener('blur', handleBlur);
			node.removeEventListener('mousedown', handleMouseDown);
			node.removeEventListener('change', handleChange);
			document.removeEventListener('mousedown', handleDocumentClick);
			observer.disconnect();
		}
	};
}
