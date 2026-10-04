export function findWizardFocusTarget(root: ParentNode): HTMLElement | null {
	const candidates = Array.from(
		root.querySelectorAll<HTMLElement>(
			'[data-wizard-autofocus], input:not([type="hidden"]), select, textarea, button[aria-haspopup="listbox"], [contenteditable="true"]'
		)
	).filter(
		(element) =>
			element.tabIndex >= 0 &&
			!element.matches(':disabled, [aria-disabled="true"]') &&
			!element.closest('[inert]') &&
			element.getClientRects().length > 0
	);
	return (
		candidates.find((element) => element.hasAttribute('data-wizard-autofocus')) ??
		candidates[0] ??
		null
	);
}

export function shouldSubmitWizardForm(form: HTMLFormElement): boolean {
	const next = form.querySelector<HTMLButtonElement>('[data-wizard-next]');
	if (next) {
		// Enter must take the same validated transition as clicking Next.
		if (!next.disabled) next.click();
		return false;
	}
	const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	return !submit?.disabled;
}

export function shouldAdvanceWizardOnEnter(
	event: Pick<
		KeyboardEvent,
		'key' | 'defaultPrevented' | 'isComposing' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
	>,
	inputType: string
): boolean {
	return (
		event.key === 'Enter' &&
		!event.defaultPrevented &&
		!event.isComposing &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey &&
		!event.shiftKey &&
		['text', 'email', 'number', 'search', 'tel', 'url', 'password'].includes(inputType)
	);
}
