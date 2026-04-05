export type CommunicationEditorTextBlockStyle =
	| 'paragraph'
	| 'heading-1'
	| 'heading-2'
	| 'heading-3';

export type CommunicationEditorBulletListStyle = 'disc' | 'circle' | 'square';

export type CommunicationEditorOrderedListStyle =
	| 'decimal'
	| 'lower-alpha'
	| 'upper-alpha'
	| 'lower-roman'
	| 'lower-greek';

export type CommunicationEditorFontFamily = 'default' | 'inter' | 'bitter' | 'mono';

export interface CommunicationEditorToolbarStateSource {
	isActive: (name: string, attributes?: Record<string, unknown>) => boolean;
	getAttributes: (name: string) => Record<string, unknown>;
}

export interface CommunicationEditorToolbarState {
	textBlockStyle: CommunicationEditorTextBlockStyle;
	bold: boolean;
	italic: boolean;
	underline: boolean;
	strike: boolean;
	link: boolean;
	blockquote: boolean;
	bulletList: boolean;
	orderedList: boolean;
	image: boolean;
	table: boolean;
	bulletListStyle: CommunicationEditorBulletListStyle;
	orderedListStyle: CommunicationEditorOrderedListStyle;
	fontFamily: CommunicationEditorFontFamily;
	fontSize: number;
}

export function getCommunicationEditorToolbarState(
	editor: CommunicationEditorToolbarStateSource | null
): CommunicationEditorToolbarState {
	const textBlockStyle: CommunicationEditorTextBlockStyle = editor?.isActive('heading', { level: 1 })
		? 'heading-1'
		: editor?.isActive('heading', { level: 2 })
			? 'heading-2'
			: editor?.isActive('heading', { level: 3 })
				? 'heading-3'
				: 'paragraph';

	const textStyleAttributes = editor?.getAttributes('textStyle') ?? {};
	const rawFontFamily = typeof textStyleAttributes.fontFamily === 'string' ? textStyleAttributes.fontFamily : '';
	const rawFontSize = typeof textStyleAttributes.fontSize === 'string' ? textStyleAttributes.fontSize : '';
	const normalizedFontFamily: CommunicationEditorFontFamily =
		rawFontFamily === 'Inter, sans-serif'
			? 'inter'
			: rawFontFamily === 'Bitter, serif'
				? 'bitter'
				: rawFontFamily === 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
					? 'mono'
					: 'default';
	const parsedFontSize = Number.parseInt(rawFontSize, 10);

	return {
		textBlockStyle,
		bold: editor?.isActive('bold') ?? false,
		italic: editor?.isActive('italic') ?? false,
		underline: editor?.isActive('underline') ?? false,
		strike: editor?.isActive('strike') ?? false,
		link: editor?.isActive('link') ?? false,
		blockquote: editor?.isActive('blockquote') ?? false,
		bulletList: editor?.isActive('bulletList') ?? false,
		orderedList: editor?.isActive('orderedList') ?? false,
		image: editor?.isActive('image') ?? false,
		table: editor?.isActive('table') ?? false,
		bulletListStyle:
			(editor?.getAttributes('bulletList').listStyleType as CommunicationEditorBulletListStyle | undefined) ??
			'disc',
		orderedListStyle:
			(editor?.getAttributes('orderedList')
				.listStyleType as CommunicationEditorOrderedListStyle | undefined) ?? 'decimal',
		fontFamily: normalizedFontFamily,
		fontSize: Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : 16
	};
}
