import type {
	CommunicationFilterOptions,
	CommunicationMessageDetail,
	CommunicationMessageSummary
} from '$lib/communications/types.js';

interface CommunicationPageHydrationSignatureInput {
	messages?: CommunicationMessageSummary[];
	selectedMessage?: CommunicationMessageDetail | null;
	filterOptions?: CommunicationFilterOptions;
	filterOptionsLoaded?: boolean;
}

export const buildCommunicationPageHydrationSignature = ({
	messages = [],
	selectedMessage = null,
	filterOptions,
	filterOptionsLoaded = false
}: CommunicationPageHydrationSignatureInput): string =>
	JSON.stringify({
		messages,
		selectedMessage,
		filterOptions: filterOptionsLoaded ? filterOptions : null,
		filterOptionsLoaded
	});
