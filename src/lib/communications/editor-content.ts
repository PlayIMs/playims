export const COMMUNICATION_EDITOR_EMPTY_HTML = '<p></p>';

interface CommunicationDraftStateSignatureInput {
	subject?: string;
	html?: string;
	json?: Record<string, unknown> | null;
	recipientGroups?: unknown[];
	manualRecipients?: unknown[];
}

interface CommunicationEditorInitialContentInput {
	initialHtml?: string;
	initialJson?: Record<string, unknown> | null;
}

interface CommunicationEditorPayloadSignatureInput {
	html?: string;
	json?: Record<string, unknown> | null;
}

export const buildCommunicationEditorContentSignature = ({
	initialHtml = '',
	initialJson = null
}: CommunicationEditorInitialContentInput): string =>
	JSON.stringify({
		html: initialHtml.trim(),
		json: initialJson
	});

export const buildCommunicationEditorPayloadSignature = ({
	html = '',
	json = null
}: CommunicationEditorPayloadSignatureInput): string =>
	buildCommunicationEditorContentSignature({
		initialHtml: html,
		initialJson: json
	});

export const buildCommunicationDraftStateSignature = ({
	subject = '',
	html = '',
	json = null,
	recipientGroups = [],
	manualRecipients = []
}: CommunicationDraftStateSignatureInput): string =>
	JSON.stringify({
		subject: subject.trim(),
		editor: {
			html: html.trim(),
			json
		},
		recipientGroups,
		manualRecipients
	});

export const getCommunicationEditorInitialContent = ({
	initialHtml = '',
	initialJson = null
}: CommunicationEditorInitialContentInput): Record<string, unknown> | string => {
	if (initialJson) {
		return initialJson;
	}

	const normalizedHtml = initialHtml.trim();
	return normalizedHtml || COMMUNICATION_EDITOR_EMPTY_HTML;
};
