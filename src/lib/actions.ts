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

const DATE_INPUT_TYPES = new Set(['date', 'datetime-local', 'month', 'week', 'time']);
const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

function isFocusable(element: HTMLElement): boolean {
	if (element.hasAttribute('disabled')) return false;
	if (element.getAttribute('aria-hidden') === 'true') return false;
	if (element.tabIndex < 0) return false;
	if (element instanceof HTMLInputElement && element.type === 'hidden') return false;

	const styles = getComputedStyle(element);
	if (styles.visibility === 'hidden' || styles.display === 'none') return false;
	return element.getClientRects().length > 0;
}

function focusAdjacentElement(current: HTMLElement, backwards: boolean): void {
	const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		isFocusable
	);
	const currentIndex = candidates.indexOf(current);
	if (currentIndex < 0) return;

	const step = backwards ? -1 : 1;
	for (
		let index = currentIndex + step;
		index >= 0 && index < candidates.length;
		index += step
	) {
		const candidate = candidates[index];
		if (!isFocusable(candidate)) continue;
		candidate.focus();
		return;
	}
}

/**
 * Action for date/time inputs so tabbing skips internal browser picker controls
 * and moves directly to the next logical form field.
 */
export function skipDatePickerTabStop(node: HTMLInputElement) {
	if (!DATE_INPUT_TYPES.has(node.type)) {
		return {
			destroy() {}
		};
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Tab') return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;

		event.preventDefault();
		focusAdjacentElement(node, event.shiftKey);
	}

	node.addEventListener('keydown', handleKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
		}
	};
}

/**
 * Action for radio inputs so each option remains individually tabbable
 * (instead of browser-default single tab stop per radio group).
 */
export function forceRadioTabStop(node: HTMLInputElement) {
	if (node.type !== 'radio') {
		return {
			destroy() {}
		};
	}

	const hadTabIndex = node.hasAttribute('tabindex');
	const previousTabIndex = node.getAttribute('tabindex');

	const applyTabIndex = () => {
		if (node.disabled) return;
		node.tabIndex = 0;
	};

	applyTabIndex();

	const observer = new MutationObserver(() => {
		applyTabIndex();
	});
	observer.observe(node, { attributes: true, attributeFilter: ['disabled', 'checked', 'tabindex'] });

	return {
		destroy() {
			observer.disconnect();
			if (hadTabIndex && previousTabIndex !== null) {
				node.setAttribute('tabindex', previousTabIndex);
			} else if (!hadTabIndex) {
				node.removeAttribute('tabindex');
			}
		}
	};
}
