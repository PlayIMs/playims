export const COMMUNICATION_EDITOR_EMPTY_HTML = '<p></p>';

interface CommunicationEditorInitialContentInput {
	initialHtml?: string;
	initialJson?: Record<string, unknown> | null;
}

export const buildCommunicationEditorContentSignature = ({
	initialHtml = '',
	initialJson = null
}: CommunicationEditorInitialContentInput): string =>
	JSON.stringify({
		html: initialHtml.trim(),
		json: initialJson
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
