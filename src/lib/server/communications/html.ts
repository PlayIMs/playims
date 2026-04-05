import sanitizeHtml from 'sanitize-html';

type SanitizeFilterFrame = {
	tag: string;
	attribs: Record<string, string | undefined>;
};

const SANITIZE_OPTIONS = {
	allowedTags: [
		'p',
		'br',
		'strong',
		'em',
		'u',
		's',
		'mark',
		'span',
		'a',
		'blockquote',
		'ul',
		'ol',
		'li',
		'h1',
		'h2',
		'h3',
		'h4',
		'img',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'colgroup',
		'col'
	],
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		span: ['style'],
		ul: ['style'],
		ol: ['style'],
		img: ['src', 'alt', 'title'],
		th: ['colspan', 'rowspan'],
		td: ['colspan', 'rowspan'],
		col: ['span']
	},
	allowedStyles: {
		span: {
			color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/],
			'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/],
			'font-family': [/^[A-Za-z0-9,\s"'-]+$/],
			'font-size': [/^\d+px$/]
		},
		ul: {
			'list-style-type': [/^(disc|circle|square)$/]
		},
		ol: {
			'list-style-type': [/^(decimal|lower-alpha|upper-alpha|lower-roman|lower-greek)$/]
		}
	},
	allowedSchemes: ['http', 'https', 'mailto', 'data'],
	allowedSchemesByTag: {
		img: ['http', 'https', 'data'],
		a: ['http', 'https', 'mailto']
	},
	transformTags: {
		a: sanitizeHtml.simpleTransform('a', {
			target: '_blank',
			rel: 'noopener noreferrer'
		})
	},
	exclusiveFilter(frame: SanitizeFilterFrame) {
		if (frame.tag === 'img') {
			return !frame.attribs.src;
		}

		return false;
	}
};

const BLOCK_TAG_PATTERN = /<\/(p|blockquote|li|ul|ol|h1|h2|h3|h4|tr|table|thead|tbody)>/gi;
const TAG_PATTERN = /<[^>]+>/g;

export const sanitizeCommunicationHtml = (value: string): string =>
	sanitizeHtml(value ?? '', SANITIZE_OPTIONS).trim();

export const communicationHtmlToPlainText = (value: string): string =>
	value
		.replace(BLOCK_TAG_PATTERN, '\n')
		.replace(/<\/(td|th)>/gi, ' ')
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
