export interface CommunicationEditorLinkDialogState {
	url: string;
	text: string;
	openInNewTab: boolean;
}

export function buildCommunicationEditorLinkDialogState(input: {
	selectedText: string | null | undefined;
	currentHref: string | null | undefined;
	currentTarget: string | null | undefined;
}): CommunicationEditorLinkDialogState {
	return {
		url: input.currentHref?.trim() ?? '',
		text: input.selectedText ?? '',
		openInNewTab: input.currentTarget === '_blank'
	};
}

export function buildCommunicationEditorLinkAttributes(input: {
	href: string;
	openInNewTab: boolean;
}): {
	href: string;
	target: '_blank' | null;
	rel: 'noopener noreferrer' | null;
} {
	return {
		href: input.href,
		target: input.openInNewTab ? '_blank' : null,
		rel: input.openInNewTab ? 'noopener noreferrer' : null
	};
}

export function resolveCommunicationEditorLinkDisplayText(input: {
	text: string;
	selectedText: string;
	url: string;
}): string {
	const explicitText = input.text.trim();
	if (explicitText.length > 0) {
		return explicitText;
	}

	const selectedText = input.selectedText.trim();
	if (selectedText.length > 0) {
		return selectedText;
	}

	return input.url.trim();
}
