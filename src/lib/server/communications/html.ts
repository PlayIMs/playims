import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'p',
		'br',
		'strong',
		'em',
		'u',
		'span',
		'a',
		'blockquote',
		'ul',
		'ol',
		'li',
		'h2',
		'h3',
		'h4'
	],
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		span: ['style']
	},
	allowedStyles: {
		span: {
			color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/],
			'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/]
		}
	},
	transformTags: {
		a: sanitizeHtml.simpleTransform('a', {
			target: '_blank',
			rel: 'noopener noreferrer'
		})
	}
};

const BLOCK_TAG_PATTERN = /<\/(p|blockquote|li|ul|ol|h2|h3|h4)>/gi;
const TAG_PATTERN = /<[^>]+>/g;

export const sanitizeCommunicationHtml = (value: string): string =>
	sanitizeHtml(value ?? '', SANITIZE_OPTIONS).trim();

export const communicationHtmlToPlainText = (value: string): string =>
	value
		.replace(BLOCK_TAG_PATTERN, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(TAG_PATTERN, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/\r\n/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
