declare module 'sanitize-html' {
	export interface AllowedAttributes {
		[tagName: string]: string[];
	}

	export interface AllowedStyles {
		[tagName: string]: {
			[styleName: string]: RegExp[];
		};
	}

	export interface IOptions {
		allowedTags?: string[];
		allowedAttributes?: AllowedAttributes;
		allowedStyles?: AllowedStyles;
		transformTags?: Record<string, TransformTag>;
	}

	export type TransformTag = (
		tagName: string,
		attribs: Record<string, string>
	) => {
		tagName: string;
		attribs: Record<string, string>;
	};

	interface SanitizeHtml {
		(input: string, options?: IOptions): string;
		simpleTransform(
			tagName: string,
			attribs?: Record<string, string>
		): TransformTag;
	}

	const sanitizeHtml: SanitizeHtml;
	export default sanitizeHtml;
}
