<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { Editor, Extension, mergeAttributes } from '@tiptap/core';
	import Color from '@tiptap/extension-color';
	import Highlight from '@tiptap/extension-highlight';
	import Image from '@tiptap/extension-image';
	import { BulletList, OrderedList } from '@tiptap/extension-list';
	import Link from '@tiptap/extension-link';
	import { TableKit } from '@tiptap/extension-table';
	import { TextStyle } from '@tiptap/extension-text-style';
	import Underline from '@tiptap/extension-underline';
	import StarterKit from '@tiptap/starter-kit';
	import {
		IconArrowBackUp,
		IconArrowForwardUp,
		IconBlockquote,
		IconBold,
		IconClearFormatting,
		IconChevronDown,
		IconChevronUp,
		IconCircleDot,
		IconColumnInsertRight,
		IconHighlight,
		IconItalic,
		IconLetterA,
		IconLetterI,
		IconLink,
		IconList,
		IconListLetters,
		IconListNumbers,
		IconPhoto,
		IconRowInsertBottom,
		IconSquare,
		IconX,
		IconTable,
		IconTableMinus,
		IconTextColor,
		IconTrash,
		IconStrikethrough,
		IconUnderline
	} from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import {
		buildCommunicationEditorPayloadSignature,
		buildCommunicationEditorContentSignature,
		getCommunicationEditorInitialContent
	} from '$lib/communications/editor-content.js';
	import { buildSpecialCharacterDialogOpenState } from '$lib/communications/editor-special-character-dialog.js';
	import {
		communicationEditorSpecialCharacters
	} from '$lib/communications/editor-special-characters.js';
	import {
		isCommunicationEditorSpecialCharacterShortcut
	} from '$lib/communications/editor-shortcuts.js';
	import {
		getCommunicationEditorToolbarState,
		type CommunicationEditorBulletListStyle as BulletListStyle,
		type CommunicationEditorOrderedListStyle as OrderedListStyle,
		type CommunicationEditorTextBlockStyle as TextBlockStyle
	} from '$lib/communications/editor-toolbar-state.js';
	import {
		buildCommunicationEditorTableConfig,
		isCommunicationEditorImageFile,
		normalizeCommunicationEditorImageAttributes,
		normalizeCommunicationEditorUrl
	} from '$lib/communications/editor-rich-media.js';

	interface EditorPayload {
		html: string;
		json: Record<string, unknown> | null;
		text: string;
	}

	interface Props {
		initialHtml?: string;
		initialJson?: Record<string, unknown> | null;
		editable?: boolean;
		onChange?: ((payload: EditorPayload) => void) | null;
	}

	type TextBlockOption = {
		value: TextBlockStyle;
		label: string;
		labelClass: string;
	};
	type FontFamilyOptionValue = 'default' | 'inter' | 'bitter' | 'mono';
	type TableActionValue =
		| 'insert-table'
		| 'add-row'
		| 'add-column'
		| 'toggle-header-row'
		| 'delete-row'
		| 'delete-column'
		| 'delete-table';

	const StyledBulletList = BulletList.extend({
		addAttributes() {
			return {
				...this.parent?.(),
				listStyleType: {
					default: 'disc',
					parseHTML: (element) =>
						element.style.listStyleType || element.getAttribute('data-list-style-type') || 'disc',
					renderHTML: (attributes) => ({
						'data-list-style-type': attributes.listStyleType,
						style: `list-style-type: ${attributes.listStyleType}`
					})
				}
			};
		},
		renderHTML({ HTMLAttributes }) {
			return ['ul', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
		}
	});

	const StyledOrderedList = OrderedList.extend({
		addAttributes() {
			return {
				...this.parent?.(),
				listStyleType: {
					default: 'decimal',
					parseHTML: (element) =>
						element.style.listStyleType || element.getAttribute('data-list-style-type') || 'decimal',
					renderHTML: (attributes) => ({
						'data-list-style-type': attributes.listStyleType,
						style: `list-style-type: ${attributes.listStyleType}`
					})
				}
			};
		},
		renderHTML({ HTMLAttributes }) {
			return ['ol', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
		}
	});

	function buildCommunicationEditorTextStyleInlineStyle(attributes: Record<string, unknown>): string {
		const styles: string[] = [];
		if (typeof attributes.fontFamily === 'string' && attributes.fontFamily.trim().length > 0) {
			styles.push(`font-family: ${attributes.fontFamily}`);
		}
		if (typeof attributes.fontSize === 'string' && attributes.fontSize.trim().length > 0) {
			styles.push(`font-size: ${attributes.fontSize}`);
		}
		return styles.join('; ');
	}

	const StyledTextStyle = TextStyle.extend({
		addAttributes() {
			return {
				...this.parent?.(),
				fontFamily: {
					default: null,
					parseHTML: (element) => element.style.fontFamily || null,
					renderHTML: (attributes) => {
						const style = buildCommunicationEditorTextStyleInlineStyle(attributes);
						return style ? { style } : {};
					}
				},
				fontSize: {
					default: null,
					parseHTML: (element) => element.style.fontSize || null,
					renderHTML: () => ({})
				}
			};
		}
	});

	let { initialHtml = '', initialJson = null, editable = true, onChange = null }: Props = $props();

	let rootElement = $state<HTMLDivElement | null>(null);
	let editorElement = $state<HTMLDivElement | null>(null);
	let editorInstance = $state<Editor | null>(null);
	let toolbarRevision = $state(0);
	let linkDialogOpen = $state(false);
	let linkValue = $state('');
	let linkInput = $state<HTMLInputElement | null>(null);
	let imageDialogOpen = $state(false);
	let imageUrl = $state('');
	let imageAlt = $state('');
	let imageTitle = $state('');
	let imageInput = $state<HTMLInputElement | null>(null);
	let imageError = $state('');
	let tableDialogOpen = $state(false);
	let tableRows = $state(3);
	let tableCols = $state(3);
	let tableWithHeaderRow = $state(true);
	let specialCharacterDialogOpen = $state(false);
	let textColor = $state('#14213d');
	let highlightColor = $state('#eedbce');
	let fontSizeInput = $state('16');
	let lastAppliedSignature = $state('');
	const defaultLinkColor = '#2563eb';
	const textBlockOptions: TextBlockOption[] = [
		{
			value: 'paragraph',
			label: 'Paragraph',
			labelClass: 'communication-editor-text-style-preview communication-editor-text-style-preview-paragraph'
		},
		{
			value: 'heading-1',
			label: 'Heading 1',
			labelClass: 'communication-editor-text-style-preview communication-editor-text-style-preview-h1'
		},
		{
			value: 'heading-2',
			label: 'Heading 2',
			labelClass: 'communication-editor-text-style-preview communication-editor-text-style-preview-h2'
		},
		{
			value: 'heading-3',
			label: 'Heading 3',
			labelClass: 'communication-editor-text-style-preview communication-editor-text-style-preview-h3'
		}
	];
	const fontFamilyOptions: Array<{ value: FontFamilyOptionValue; label: string }> = [
		{ value: 'default', label: 'Default' },
		{ value: 'inter', label: 'Inter' },
		{ value: 'bitter', label: 'Bitter' },
		{ value: 'mono', label: 'Mono' }
	];

	const editor = $derived(editorInstance);
	const toolbarState = $derived.by(() => {
		toolbarRevision;
		return getCommunicationEditorToolbarState(editorInstance);
	});
	const activeTextBlockStyle = $derived.by<TextBlockStyle>(() => toolbarState.textBlockStyle);
	const activeBulletListStyle = $derived.by<BulletListStyle>(() => toolbarState.bulletListStyle);
	const activeOrderedListStyle = $derived.by<OrderedListStyle>(() => toolbarState.orderedListStyle);
	const imageIsSelected = $derived.by(() => toolbarState.image);
	const tableIsSelected = $derived.by(() => toolbarState.table);
	const activeFontFamilyOption = $derived.by(
		() => fontFamilyOptions.find((option) => option.value === toolbarState.fontFamily) ?? fontFamilyOptions[0]
	);
	const activeTextBlockOption = $derived.by(
		() => textBlockOptions.find((option) => option.value === activeTextBlockStyle) ?? textBlockOptions[0]
	);
	const tableActionOptions = $derived.by(() => [
		{
			value: 'insert-table',
			label: 'Insert',
			labelIcon: IconTable,
			labelIconAriaLabel: 'Insert table',
			disabled: !editable || !editor
		},
		{
			value: 'add-row',
			label: 'Add row',
			labelIcon: IconRowInsertBottom,
			labelIconAriaLabel: 'Add row',
			disabled: !canRun((nextEditor) => nextEditor.can().chain().focus().addRowAfter().run())
		},
		{
			value: 'add-column',
			label: 'Add column',
			labelIcon: IconColumnInsertRight,
			labelIconAriaLabel: 'Add column',
			disabled: !canRun((nextEditor) => nextEditor.can().chain().focus().addColumnAfter().run())
		},
		{
			value: 'toggle-header-row',
			label: 'Header row',
			labelIcon: IconTable,
			labelIconAriaLabel: 'Toggle header row',
			disabled: !canRun((nextEditor) => nextEditor.can().chain().focus().toggleHeaderRow().run())
		},
		{
			value: 'delete-row',
			label: 'Delete row',
			labelIcon: IconRowInsertBottom,
			labelIconAriaLabel: 'Delete row',
			disabled: !canRun((nextEditor) => nextEditor.can().chain().focus().deleteRow().run())
		},
		{
			value: 'delete-column',
			label: 'Delete column',
			labelIcon: IconColumnInsertRight,
			labelIconAriaLabel: 'Delete column',
			disabled: !canRun((nextEditor) => nextEditor.can().chain().focus().deleteColumn().run())
		},
		{
			value: 'delete-table',
			label: 'Remove',
			labelIcon: IconTrash,
			labelIconAriaLabel: 'Remove table',
			disabled: !canRun((nextEditor) => nextEditor.can().chain().focus().deleteTable().run())
		}
	]);
	const bulletListStyleOptions = [
		{
			value: 'disc',
			label: 'Disc',
			labelIcon: IconList,
			labelIconAriaLabel: 'Disc bullets'
		},
		{
			value: 'circle',
			label: 'Circle',
			labelIcon: IconCircleDot,
			labelIconAriaLabel: 'Circle bullets'
		},
		{
			value: 'square',
			label: 'Square',
			labelIcon: IconSquare,
			labelIconAriaLabel: 'Square bullets'
		}
	];
	const orderedListStyleOptions = [
		{
			value: 'decimal',
			label: 'Numbers',
			labelIcon: IconListNumbers,
			labelIconAriaLabel: 'Decimal numbering'
		},
		{
			value: 'lower-alpha',
			label: 'Lower alpha',
			labelIcon: IconListLetters,
			labelIconAriaLabel: 'Lower alpha numbering'
		},
		{
			value: 'upper-alpha',
			label: 'Upper alpha',
			labelIcon: IconLetterA,
			labelIconAriaLabel: 'Upper alpha numbering'
		},
		{
			value: 'lower-roman',
			label: 'Roman',
			labelIcon: IconLetterI,
			labelIconAriaLabel: 'Roman numbering'
		},
		{
			value: 'lower-greek',
			label: 'Greek',
			labelIcon: IconLetterA,
			labelIconAriaLabel: 'Greek numbering'
		}
	];

	const emitChange = (nextEditor: Editor): void => {
		lastAppliedSignature = buildCommunicationEditorPayloadSignature({
			html: nextEditor.getHTML(),
			json: nextEditor.getJSON() as Record<string, unknown>
		});

		onChange?.({
			html: nextEditor.getHTML(),
			json: nextEditor.getJSON() as Record<string, unknown>,
			text: nextEditor.getText()
		});
	};

	const setEditorState = (nextEditor: Editor | null, bumpRevision = true): void => {
		editorInstance = nextEditor;
		if (bumpRevision) {
			toolbarRevision += 1;
		}
	};

	function toolbarButtonClass(active = false): string {
		return [
			active ? 'button-secondary-outlined bg-secondary-100 border-secondary-700 text-secondary-950 hover:bg-secondary-100 active:bg-secondary-100' : 'button-neutral-outlined',
			'min-h-9 min-w-9 px-2 py-2 text-xs font-semibold cursor-pointer justify-center disabled:cursor-not-allowed disabled:opacity-45'
		].join(' ');
	}

	function toolbarTextButtonClass(active = false): string {
		return [
			active ? 'button-secondary-outlined bg-secondary-100 border-secondary-700 text-secondary-950 hover:bg-secondary-100 active:bg-secondary-100' : 'button-neutral-outlined',
			'min-h-9 px-3 py-2 text-xs font-semibold cursor-pointer justify-center disabled:cursor-not-allowed disabled:opacity-45'
		].join(' ');
	}

	function toolbarSplitButtonShellClass(active = false): string {
		return [
			'inline-flex h-9 items-stretch overflow-hidden border-2 align-middle',
			active
				? 'border-secondary-700 bg-secondary-100 text-secondary-950'
				: 'border-neutral-950 bg-transparent text-neutral-950'
		].join(' ');
	}

	function toolbarSplitMainButtonClass(active = false): string {
		return [
			'inline-flex h-full min-w-9 items-center justify-center border-0 bg-transparent px-2 py-2 text-xs font-semibold cursor-pointer',
			active ? 'hover:bg-secondary-100 active:bg-secondary-100' : 'hover:bg-neutral-100/80',
			'disabled:cursor-not-allowed disabled:opacity-45'
		].join(' ');
	}

	function toolbarSplitMenuButtonClass(active = false): string {
		return [
			'inline-flex h-full w-8 items-center justify-center border-0 bg-transparent px-1.5 py-2 text-xs font-semibold cursor-pointer',
			active ? 'hover:bg-secondary-100 active:bg-secondary-100' : 'hover:bg-neutral-100/80',
			'disabled:cursor-not-allowed disabled:opacity-45'
		].join(' ');
	}

	function toolbarColorButtonClass(): string {
		return [
			'communication-editor-color-tool inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center border-2 border-neutral-950 bg-transparent px-2 py-2',
			'hover:bg-neutral-100/80'
		].join(' ');
	}

	function toolbarFontSizeShellClass(): string {
		return 'inline-flex h-9 items-stretch overflow-hidden border-2 border-neutral-950 bg-white align-middle';
	}

	function toolbarFontSizeButtonClass(): string {
		return [
			'inline-flex h-9 w-8 items-center justify-center border-0 bg-transparent px-0 text-sm font-semibold cursor-pointer',
			'hover:bg-neutral-100/80 disabled:cursor-not-allowed disabled:opacity-45'
		].join(' ');
	}

	function toolbarFontSizeInputClass(): string {
		return 'communication-editor-font-size-input h-9 w-16 border-0 border-x-2 border-neutral-950 bg-transparent px-0 text-center text-sm font-semibold leading-none text-neutral-950 focus:outline-none';
	}

	function handleToolbarMouseDown(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		if (target.closest('input, textarea, select')) {
			return;
		}

		if (target.closest('[data-toolbar-allows-default-mousedown], [data-listbox-dropdown-trigger]')) {
			return;
		}

		if (target.closest('button')) {
			event.preventDefault();
		}
	}

	function runCommand(command: (nextEditor: Editor) => boolean | void): void {
		if (!editor || !editable) {
			return;
		}

		const result = command(editor);
		if (result === false) {
			return;
		}

		setEditorState(editor);
	}

	function canRun(check: (nextEditor: Editor) => boolean): boolean {
		if (!editor || !editable) {
			return false;
		}

		return check(editor);
	}

	function canUseListControls(): boolean {
		return Boolean(editor && editable);
	}

	function canUndo(): boolean {
		if (!editor || !editable) {
			return false;
		}

		return editor.can().undo();
	}

	function canRedo(): boolean {
		if (!editor || !editable) {
			return false;
		}

		return editor.can().redo();
	}

	function applyTextBlockStyle(value: TextBlockStyle): void {
		runCommand((nextEditor) => {
			const chain = nextEditor.chain().focus();
			switch (value) {
				case 'heading-1':
					chain.setHeading({ level: 1 }).run();
					return;
				case 'heading-2':
					chain.setHeading({ level: 2 }).run();
					return;
				case 'heading-3':
					chain.setHeading({ level: 3 }).run();
					return;
				default:
					chain.setParagraph().run();
			}
		});
	}

	function getCommunicationEditorFontFamilyCssValue(value: FontFamilyOptionValue): string | null {
		switch (value) {
			case 'inter':
				return 'Inter, sans-serif';
			case 'bitter':
				return 'Bitter, serif';
			case 'mono':
				return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
			default:
				return null;
		}
	}

	function clampCommunicationEditorFontSize(value: number): number {
		return Math.min(Math.max(Math.round(value), 10), 72);
	}

	function applyFontFamily(value: string): void {
		const fontFamily = getCommunicationEditorFontFamilyCssValue(value as FontFamilyOptionValue);
		runCommand((nextEditor) =>
			nextEditor
				.chain()
				.focus()
				.setMark('textStyle', { fontFamily })
				.run()
		);
	}

	function setFontSizeValue(value: number): void {
		const normalized = clampCommunicationEditorFontSize(value);
		fontSizeInput = String(normalized);
		runCommand((nextEditor) =>
			nextEditor
				.chain()
				.focus()
				.setMark('textStyle', { fontSize: `${normalized}px` })
				.run()
		);
	}

	function handleFontSizeInput(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		fontSizeInput = value;
		const parsed = Number.parseInt(value, 10);
		if (!Number.isFinite(parsed)) {
			return;
		}
		setFontSizeValue(parsed);
	}

	function syncFontSizeInputFromToolbar(): void {
		fontSizeInput = String(toolbarState.fontSize);
	}

	function decreaseFontSize(): void {
		setFontSizeValue(toolbarState.fontSize - 1);
	}

	function increaseFontSize(): void {
		setFontSizeValue(toolbarState.fontSize + 1);
	}

	function applyBulletListStyle(value: string): void {
		const style = value as BulletListStyle;
		runCommand((nextEditor) => {
			if (nextEditor.isActive('bulletList')) {
				return nextEditor.chain().focus().updateAttributes('bulletList', { listStyleType: style }).run();
			}

			return nextEditor
				.chain()
				.focus()
				.toggleBulletList()
				.updateAttributes('bulletList', { listStyleType: style })
				.run();
		});
	}

	function toggleDefaultBulletList(): void {
		runCommand((nextEditor) => {
			if (nextEditor.isActive('bulletList')) {
				return nextEditor.chain().focus().toggleBulletList().run();
			}

			return nextEditor
				.chain()
				.focus()
				.toggleBulletList()
				.updateAttributes('bulletList', { listStyleType: 'disc' })
				.run();
		});
	}

	function applyOrderedListStyle(value: string): void {
		const style = value as OrderedListStyle;
		runCommand((nextEditor) => {
			if (nextEditor.isActive('orderedList')) {
				return nextEditor
					.chain()
					.focus()
					.updateAttributes('orderedList', { listStyleType: style })
					.run();
			}

			return nextEditor
				.chain()
				.focus()
				.toggleOrderedList()
				.updateAttributes('orderedList', { listStyleType: style })
				.run();
		});
	}

	function toggleDefaultOrderedList(): void {
		runCommand((nextEditor) => {
			if (nextEditor.isActive('orderedList')) {
				return nextEditor.chain().focus().toggleOrderedList().run();
			}

			return nextEditor
				.chain()
				.focus()
				.toggleOrderedList()
				.updateAttributes('orderedList', { listStyleType: 'decimal' })
				.run();
		});
	}

	function openLinkDialog(value?: string): void {
		if (!editable) {
			return;
		}

		imageDialogOpen = false;
		tableDialogOpen = false;
		specialCharacterDialogOpen = false;
		linkValue = value ?? editor?.getAttributes('link').href ?? '';
		linkDialogOpen = true;
		void tick().then(() => {
			linkInput?.focus();
			linkInput?.select();
		});
	}

	function closeLinkDialog(): void {
		linkDialogOpen = false;
		linkValue = '';
		editor?.commands.focus();
	}

	function applyLink(): void {
		runCommand((nextEditor) => {
			const value = linkValue.trim();
			if (!value) {
				nextEditor.chain().focus().unsetLink().run();
				closeLinkDialog();
				return;
			}

			const normalized = normalizeCommunicationEditorUrl(value);
			if (!normalized) {
				return false;
			}

			nextEditor
				.chain()
				.focus()
				.extendMarkRange('link')
				.setColor(defaultLinkColor)
				.setLink({ href: normalized })
				.run();
			closeLinkDialog();
		});
	}

	function removeLink(): void {
		runCommand((nextEditor) => {
			nextEditor.chain().focus().unsetLink().run();
			closeLinkDialog();
		});
	}

	function getDroppedImageAltText(fileName: string): string | undefined {
		const normalizedName = fileName.replace(/\.[^.]+$/, '').trim();
		return normalizedName || undefined;
	}

	function readImageFileAsDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = () => {
				if (typeof reader.result === 'string') {
					resolve(reader.result);
					return;
				}

				reject(new Error('Image reader did not return a data URL.'));
			};
			reader.onerror = () => reject(reader.error ?? new Error('Unable to read the image file.'));

			reader.readAsDataURL(file);
		});
	}

	function getImageFiles(fileList: FileList | null | undefined): File[] {
		return Array.from(fileList ?? []).filter((file) => isCommunicationEditorImageFile(file));
	}

	async function insertImageFiles(files: File[], dropPosition?: number): Promise<void> {
		if (!editor || !editable || files.length === 0) {
			return;
		}

		const imageNodes = await Promise.all(
			files.map(async (file) => ({
				type: 'image',
				attrs: {
					src: await readImageFileAsDataUrl(file),
					alt: getDroppedImageAltText(file.name)
				}
			}))
		);

		runCommand((nextEditor) => {
			const chain =
				dropPosition === undefined
					? nextEditor.chain().focus()
					: nextEditor.chain().focus(dropPosition);

			chain
				.insertContent(
					imageNodes.flatMap((node, index) =>
						index === imageNodes.length - 1 ? [node] : [node, { type: 'paragraph' }]
					)
				)
				.run();
		});
	}

	function openImageDialog(): void {
		if (!editable) {
			return;
		}

		linkDialogOpen = false;
		tableDialogOpen = false;
		specialCharacterDialogOpen = false;
		const imageAttributes = editor?.getAttributes('image') ?? {};
		imageUrl = imageIsSelected ? (imageAttributes.src ?? '') : '';
		imageAlt = imageIsSelected ? (imageAttributes.alt ?? '') : '';
		imageTitle = imageIsSelected ? (imageAttributes.title ?? '') : '';
		imageError = '';
		imageDialogOpen = true;
		void tick().then(() => {
			imageInput?.focus();
			imageInput?.select();
		});
	}

	function closeImageDialog(): void {
		imageDialogOpen = false;
		imageUrl = '';
		imageAlt = '';
		imageTitle = '';
		imageError = '';
		editor?.commands.focus();
	}

	function applyImage(): void {
		runCommand((nextEditor) => {
			const normalized = normalizeCommunicationEditorImageAttributes({
				src: imageUrl,
				alt: imageAlt,
				title: imageTitle
			});
			if (!normalized) {
				imageError = 'Enter a valid remote image URL, such as https://example.com/banner.png.';
				return false;
			}

			if (nextEditor.isActive('image')) {
				nextEditor.chain().focus().updateAttributes('image', normalized).run();
			} else {
				nextEditor.chain().focus().setImage(normalized).run();
			}

			closeImageDialog();
		});
	}

	function removeImage(): void {
		runCommand((nextEditor) => {
			nextEditor.chain().focus().deleteSelection().run();
			closeImageDialog();
		});
	}

	function openTableDialog(): void {
		if (!editable) {
			return;
		}

		linkDialogOpen = false;
		imageDialogOpen = false;
		specialCharacterDialogOpen = false;
		tableRows = 3;
		tableCols = 3;
		tableWithHeaderRow = true;
		tableDialogOpen = true;
	}

	function closeTableDialog(): void {
		tableDialogOpen = false;
		editor?.commands.focus();
	}

	function applyTable(): void {
		runCommand((nextEditor) => {
			const tableConfig = buildCommunicationEditorTableConfig({
				rows: tableRows,
				cols: tableCols,
				withHeaderRow: tableWithHeaderRow
			});

			nextEditor.chain().focus().insertTable(tableConfig).run();
			closeTableDialog();
		});
	}

	function openSpecialCharacterDialog(): void {
		if (!editable) {
			return;
		}

		const openState = buildSpecialCharacterDialogOpenState(communicationEditorSpecialCharacters);
		linkDialogOpen = false;
		imageDialogOpen = false;
		tableDialogOpen = false;
		specialCharacterDialogOpen = true;
		void tick().then(() => {
			if (!specialCharacterDialogOpen || openState.initialFocusIndex === null) {
				return;
			}

			const firstButton = document.querySelector<HTMLButtonElement>(
				`[data-special-character-index="${openState.initialFocusIndex}"]`
			);
			firstButton?.focus();
		});
	}

	function closeSpecialCharacterDialog(): void {
		specialCharacterDialogOpen = false;
		editor?.commands.focus();
	}

	function insertSpecialCharacter(value: string): void {
		if (!value) {
			return;
		}

		runCommand((nextEditor) => {
			nextEditor.chain().focus().insertContent(value).run();
		});
		closeSpecialCharacterDialog();
	}

	function handleTableAction(value: string): void {
		switch (value as TableActionValue) {
			case 'insert-table':
				openTableDialog();
				return;
			case 'add-row':
				runCommand((nextEditor) => nextEditor.chain().focus().addRowAfter().run());
				return;
			case 'add-column':
				runCommand((nextEditor) => nextEditor.chain().focus().addColumnAfter().run());
				return;
			case 'toggle-header-row':
				runCommand((nextEditor) => nextEditor.chain().focus().toggleHeaderRow().run());
				return;
			case 'delete-row':
				runCommand((nextEditor) => nextEditor.chain().focus().deleteRow().run());
				return;
			case 'delete-column':
				runCommand((nextEditor) => nextEditor.chain().focus().deleteColumn().run());
				return;
			case 'delete-table':
				runCommand((nextEditor) => nextEditor.chain().focus().deleteTable().run());
				return;
		}
	}

	function applyTextColor(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		textColor = value;
		runCommand((nextEditor) => {
			nextEditor.chain().focus().setColor(value).run();
		});
	}

	function applyHighlightColor(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		highlightColor = value;
		runCommand((nextEditor) => {
			nextEditor.chain().focus().setHighlight({ color: value }).run();
		});
	}

	function selectClickedLink(anchor: HTMLAnchorElement): void {
		if (!editor) {
			return;
		}

		try {
			const from = editor.view.posAtDOM(anchor, 0);
			const textLength = anchor.textContent?.length ?? 0;
			if (textLength > 0) {
				editor
					.chain()
					.focus()
					.setTextSelection({ from, to: from + textLength })
					.run();
			} else {
				editor.chain().focus().setTextSelection(from).run();
			}
			editor.chain().focus().extendMarkRange('link').run();
			setEditorState(editor);
		} catch {
			editor.commands.focus();
			setEditorState(editor);
		}
	}

	function selectClickedImage(image: HTMLImageElement): void {
		if (!editor) {
			return;
		}

		try {
			const position = editor.view.posAtDOM(image, 0);
			editor.chain().focus().setNodeSelection(position).run();
			setEditorState(editor);
		} catch {
			editor.commands.focus();
			setEditorState(editor);
		}
	}

	function handleEditorClick(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !editable) {
			return;
		}

		const image = target.closest('img');
		if (image instanceof HTMLImageElement) {
			event.preventDefault();
			event.stopPropagation();
			selectClickedImage(image);
			return;
		}

		const anchor = target.closest('a');
		if (!(anchor instanceof HTMLAnchorElement)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		selectClickedLink(anchor);
		openLinkDialog(anchor.getAttribute('href') ?? '');
	}

	function focusEditorFromShell(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !editable || !editor) {
			return;
		}

		if (
			target.closest(
				'button, input, textarea, select, a, img, [role="dialog"], [data-listbox-dropdown-panel], [data-listbox-dropdown-trigger]'
			)
		) {
			return;
		}

		editor.commands.focus('end');
	}

	onMount(() => {
		if (!editorElement) {
			return;
		}

		const communicationKeyboardShortcuts = Extension.create({
			name: 'communicationKeyboardShortcuts',
			addKeyboardShortcuts() {
				return {
					'Mod-k': () => {
						openLinkDialog();
						return true;
					},
					'Mod-Shift-i': () => {
						openImageDialog();
						return true;
					},
					'Mod-Alt-t': () => {
						openTableDialog();
						return true;
					},
					'Mod-y': () => this.editor.commands.redo()
				};
			}
		});

		const nextEditor = new Editor({
			element: editorElement,
			editable,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3]
					},
					bulletList: false,
					orderedList: false,
					link: false,
					underline: false,
					horizontalRule: false
				}),
				StyledBulletList.configure({
					keepMarks: true,
					keepAttributes: true
				}),
				StyledOrderedList.configure({
					keepMarks: true,
					keepAttributes: true
				}),
				Underline,
				Link.configure({
					openOnClick: 'whenNotEditable',
					enableClickSelection: true,
					defaultProtocol: 'https',
					HTMLAttributes: {
						rel: 'noopener noreferrer',
						target: '_blank'
					}
				}),
				Image.configure({
					allowBase64: true,
					HTMLAttributes: {
						class: 'communication-editor-image'
					},
					resize: {
						enabled: true,
						minWidth: 120,
						minHeight: 80,
						alwaysPreserveAspectRatio: true
					}
				}),
				TableKit.configure({
					table: {
						HTMLAttributes: {
							class: 'communication-editor-table'
						},
						resizable: true
					},
					tableHeader: {
						HTMLAttributes: {
							class: 'communication-editor-table-header'
						}
					},
					tableCell: {
						HTMLAttributes: {
							class: 'communication-editor-table-cell'
						}
					}
				}),
				communicationKeyboardShortcuts,
				StyledTextStyle,
				Color,
				Highlight.configure({ multicolor: true })
			],
			editorProps: {
				handleDrop: (view, event, _slice, moved) => {
					if (moved) {
						return false;
					}

					const imageFiles = getImageFiles(event.dataTransfer?.files);
					if (imageFiles.length === 0) {
						return false;
					}

					event.preventDefault();
					const coordinates = view.posAtCoords({
						left: event.clientX,
						top: event.clientY
					});
					void insertImageFiles(imageFiles, coordinates?.pos);
					return true;
				},
				handlePaste: (_view, event) => {
					const imageFiles = getImageFiles(event.clipboardData?.files);
					if (imageFiles.length === 0) {
						return false;
					}

					event.preventDefault();
					void insertImageFiles(imageFiles);
					return true;
				}
			},
			content: getCommunicationEditorInitialContent({ initialHtml, initialJson }),
			onUpdate: ({ editor: updatedEditor }) => {
				emitChange(updatedEditor);
			},
			onSelectionUpdate: ({ editor: updatedEditor }) => {
				setEditorState(updatedEditor);
			},
			onFocus: ({ editor: updatedEditor }) => {
				setEditorState(updatedEditor);
			},
			onBlur: ({ editor: updatedEditor }) => {
				setEditorState(updatedEditor);
			},
			onTransaction: ({ editor: updatedEditor }) => {
				setEditorState(updatedEditor);
			}
		});

		setEditorState(nextEditor);
		lastAppliedSignature = buildCommunicationEditorContentSignature({ initialHtml, initialJson });

		rootElement?.addEventListener('click', handleEditorClick);
	});

	onDestroy(() => {
		rootElement?.removeEventListener('click', handleEditorClick);
		editor?.destroy();
		setEditorState(null);
	});

	$effect(() => {
		if (!editor) {
			return;
		}

		editor.setEditable(editable);
	});

	$effect(() => {
		if (!editor) {
			return;
		}

		const nextSignature = buildCommunicationEditorContentSignature({ initialHtml, initialJson });
		if (nextSignature === lastAppliedSignature) {
			return;
		}

		lastAppliedSignature = nextSignature;
		editor.commands.setContent(getCommunicationEditorInitialContent({ initialHtml, initialJson }), {
			emitUpdate: false
		});
	});

	$effect(() => {
		toolbarRevision;
		syncFontSizeInputFromToolbar();
	});

	$effect(() => {
		if (
			!(linkDialogOpen || imageDialogOpen || tableDialogOpen || specialCharacterDialogOpen) ||
			typeof window === 'undefined'
		) {
			return;
		}

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();

			if (imageDialogOpen) {
				closeImageDialog();
				return;
			}

			if (tableDialogOpen) {
				closeTableDialog();
				return;
			}

			if (specialCharacterDialogOpen) {
				closeSpecialCharacterDialog();
				return;
			}

			closeLinkDialog();
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});

	$effect(() => {
		const editorHost = editorElement;
		if (
			!editable ||
			typeof window === 'undefined' ||
			!editorHost ||
			linkDialogOpen ||
			imageDialogOpen ||
			tableDialogOpen ||
			specialCharacterDialogOpen
		) {
			return;
		}

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (!isCommunicationEditorSpecialCharacterShortcut(event)) {
				return;
			}

			if (!(event.target instanceof Node) || !editorHost.contains(event.target)) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			openSpecialCharacterDialog();
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});
</script>

<div
	bind:this={rootElement}
	class="section-card space-y-3 p-3 communication-rich-editor relative"
	data-communication-editor-root
>
	{#if editable}
		<div
			class="space-y-2 border border-neutral-950 bg-neutral-50 p-2"
			role="presentation"
			onmousedown={handleToolbarMouseDown}
		>
			<div class="flex flex-wrap items-center gap-2">
					<HoverTooltip text="Bold" shortcutKeys={['Mod', 'B']}>
						<button
							type="button"
							class={toolbarButtonClass(toolbarState.bold)}
							aria-label="Bold"
							disabled={!canRun((nextEditor) => nextEditor.can().chain().focus().toggleBold().run())}
							onclick={() => runCommand((nextEditor) => nextEditor.chain().focus().toggleBold().run())}
						>
							<IconBold class="h-4 w-4" />
						</button>
					</HoverTooltip>
					<HoverTooltip text="Italic" shortcutKeys={['Mod', 'I']}>
						<button
							type="button"
							class={toolbarButtonClass(toolbarState.italic)}
							aria-label="Italic"
							disabled={!canRun((nextEditor) => nextEditor.can().chain().focus().toggleItalic().run())}
							onclick={() =>
								runCommand((nextEditor) => nextEditor.chain().focus().toggleItalic().run())}
						>
							<IconItalic class="h-4 w-4" />
						</button>
					</HoverTooltip>
					<HoverTooltip text="Underline" shortcutKeys={['Mod', 'U']}>
						<button
							type="button"
							class={toolbarButtonClass(toolbarState.underline)}
							aria-label="Underline"
							disabled={
								!canRun((nextEditor) => nextEditor.can().chain().focus().toggleUnderline().run())
							}
							onclick={() =>
								runCommand((nextEditor) => nextEditor.chain().focus().toggleUnderline().run())}
						>
							<IconUnderline class="h-4 w-4" />
						</button>
					</HoverTooltip>
					<HoverTooltip text="Strikethrough" shortcutKeys={['Mod', 'Shift', 'S']}>
						<button
							type="button"
							class={toolbarButtonClass(toolbarState.strike)}
							aria-label="Strikethrough"
							disabled={!canRun((nextEditor) => nextEditor.can().chain().focus().toggleStrike().run())}
							onclick={() => runCommand((nextEditor) => nextEditor.chain().focus().toggleStrike().run())}
						>
							<IconStrikethrough class="h-4 w-4" />
						</button>
					</HoverTooltip>
					<HoverTooltip text="Hyperlink" shortcutKeys={['Mod', 'K']}>
						<button
							type="button"
							class={toolbarButtonClass(toolbarState.link)}
							aria-label="Hyperlink"
							disabled={!editor}
							data-toolbar-allows-default-mousedown="true"
							onclick={() => openLinkDialog()}
						>
							<IconLink class="h-4 w-4" />
						</button>
					</HoverTooltip>
					<HoverTooltip text="Clear formatting">
						<button
							type="button"
							class={toolbarButtonClass()}
							aria-label="Clear formatting"
							disabled={
								!canRun((nextEditor) =>
									nextEditor.can().chain().focus().unsetAllMarks().clearNodes().run()
								)
							}
							onclick={() =>
								runCommand((nextEditor) =>
									nextEditor.chain().focus().unsetAllMarks().clearNodes().run()
								)}
						>
							<IconClearFormatting class="h-4 w-4" />
						</button>
					</HoverTooltip>
					<div class={toolbarSplitButtonShellClass(toolbarState.bulletList)}>
						<HoverTooltip
							text={toolbarState.bulletList ? 'Turn off bulleted list' : 'Bulleted list'}
						>
							<button
								type="button"
								class={toolbarSplitMainButtonClass(toolbarState.bulletList)}
								aria-label="Bulleted list"
								disabled={!canUseListControls()}
								onclick={toggleDefaultBulletList}
							>
								<IconList class="h-4 w-4" />
							</button>
						</HoverTooltip>
						<ListboxDropdown
							options={bulletListStyleOptions}
							value={activeBulletListStyle}
							ariaLabel="Bulleted list style"
							buttonClass={toolbarSplitMenuButtonClass(toolbarState.bulletList)}
							listClass="mt-1 w-44 border-2 border-neutral-950 bg-white z-20 max-h-72 overflow-y-auto scrollbar-thin"
							optionClass="w-full text-left px-3 py-2 text-sm text-neutral-900 cursor-pointer"
							activeOptionClass="bg-neutral-100 text-neutral-900"
							on:change={(event) => {
								applyBulletListStyle(event.detail.value);
							}}
						>
							{#snippet trigger(open)}
								{#if open}
									<IconChevronUp class="h-4 w-4 shrink-0" />
								{:else}
									<IconChevronDown class="h-4 w-4 shrink-0" />
								{/if}
							{/snippet}
						</ListboxDropdown>
					</div>
					<div class={toolbarSplitButtonShellClass(toolbarState.orderedList)}>
						<HoverTooltip
							text={toolbarState.orderedList ? 'Turn off numbered list' : 'Numbered list'}
						>
							<button
								type="button"
								class={toolbarSplitMainButtonClass(toolbarState.orderedList)}
								aria-label="Numbered list"
								disabled={!canUseListControls()}
								onclick={toggleDefaultOrderedList}
							>
								<IconListNumbers class="h-4 w-4" />
							</button>
						</HoverTooltip>
						<ListboxDropdown
							options={orderedListStyleOptions}
							value={activeOrderedListStyle}
							ariaLabel="Numbered list style"
							buttonClass={toolbarSplitMenuButtonClass(toolbarState.orderedList)}
							listClass="mt-1 w-48 border-2 border-neutral-950 bg-white z-20 max-h-72 overflow-y-auto scrollbar-thin"
							optionClass="w-full text-left px-3 py-2 text-sm text-neutral-900 cursor-pointer"
							activeOptionClass="bg-neutral-100 text-neutral-900"
							on:change={(event) => {
								applyOrderedListStyle(event.detail.value);
							}}
						>
							{#snippet trigger(open)}
								{#if open}
									<IconChevronUp class="h-4 w-4 shrink-0" />
								{:else}
									<IconChevronDown class="h-4 w-4 shrink-0" />
								{/if}
							{/snippet}
						</ListboxDropdown>
					</div>
					<HoverTooltip text="Blockquote">
						<button
							type="button"
							class={toolbarButtonClass(toolbarState.blockquote)}
							aria-label="Blockquote"
							disabled={
								!canRun((nextEditor) => nextEditor.can().chain().focus().toggleBlockquote().run())
							}
							onclick={() =>
								runCommand((nextEditor) => nextEditor.chain().focus().toggleBlockquote().run())}
						>
							<IconBlockquote class="h-4 w-4" />
						</button>
					</HoverTooltip>
				<HoverTooltip text="Text color">
					<label class={toolbarColorButtonClass()}>
							<span class="communication-editor-color-tool-icon">
								<IconTextColor class="h-4 w-4" />
								<span
									class="communication-editor-color-tool-preview"
									style={`background-color: ${textColor};`}
									aria-hidden="true"
								></span>
							</span>
							<span class="sr-only">Text color</span>
							<input
								class="communication-editor-color-tool-input"
								type="color"
								value={textColor}
								oninput={applyTextColor}
							/>
						</label>
					</HoverTooltip>
				<HoverTooltip text="Highlight color">
					<label class={toolbarColorButtonClass()}>
							<span class="communication-editor-color-tool-icon">
								<IconHighlight class="h-4 w-4" />
								<span
									class="communication-editor-color-tool-preview"
									style={`background-color: ${highlightColor};`}
									aria-hidden="true"
								></span>
							</span>
							<span class="sr-only">Highlight color</span>
							<input
								class="communication-editor-color-tool-input"
								type="color"
								value={highlightColor}
								oninput={applyHighlightColor}
							/>
						</label>
					</HoverTooltip>
				<HoverTooltip
					text={imageIsSelected ? 'Edit selected image' : 'Insert image'}
					shortcutKeys={['Mod', 'Shift', 'I']}
				>
					<button
						type="button"
						class={toolbarButtonClass(imageIsSelected)}
						aria-label={imageIsSelected ? 'Edit image' : 'Insert image'}
						disabled={!editor}
						data-toolbar-allows-default-mousedown="true"
						onclick={() => openImageDialog()}
					>
						<IconPhoto class="h-4 w-4" />
					</button>
				</HoverTooltip>
				<HoverTooltip text="Special characters" shortcutKeys={['Alt', 'Shift', 'S']}>
					<button
						type="button"
						class={toolbarButtonClass(specialCharacterDialogOpen)}
						aria-label="Special characters"
						disabled={!editor}
						data-toolbar-allows-default-mousedown="true"
						onclick={openSpecialCharacterDialog}
					>
						<span class="text-sm font-semibold leading-none" aria-hidden="true">&#937;</span>
					</button>
				</HoverTooltip>
				<ListboxDropdown
					options={tableActionOptions}
					value=""
					mode="action"
					ariaLabel="Table tools"
					buttonClass={`${tableIsSelected ? 'button-secondary-outlined bg-secondary-100 border-secondary-700 text-secondary-950 hover:bg-secondary-100 active:bg-secondary-100' : 'button-neutral-outlined'} h-9 px-3 py-2 text-xs font-semibold cursor-pointer inline-flex items-center justify-between gap-2`}
					listClass="mt-1 w-52 border-2 border-neutral-950 bg-white z-20 max-h-72 overflow-y-auto scrollbar-thin"
					optionClass="w-full text-left px-3 py-2 text-sm text-neutral-900 cursor-pointer"
					activeOptionClass="bg-neutral-100 text-neutral-900"
					on:action={(event) => {
						handleTableAction(event.detail.value);
					}}
				>
					{#snippet trigger(open)}
						<span class="inline-flex items-center gap-2">
							<IconTable class="h-4 w-4" />
							<span>Table</span>
						</span>
						{#if open}
							<IconChevronUp class="h-4 w-4 shrink-0" />
						{:else}
							<IconChevronDown class="h-4 w-4 shrink-0" />
						{/if}
					{/snippet}
				</ListboxDropdown>
				<div class="ml-auto flex items-center gap-2">
					<HoverTooltip text="Undo" shortcutKeys={['Mod', 'Z']}>
						<button
							type="button"
							class={toolbarButtonClass()}
							aria-label="Undo"
							disabled={!canUndo()}
							onclick={() => runCommand((nextEditor) => nextEditor.chain().focus().undo().run())}
						>
							<IconArrowBackUp class="h-4 w-4" />
						</button>
					</HoverTooltip>
					<HoverTooltip text="Redo" shortcutKeys={['Mod', 'Shift', 'Z']}>
						<button
							type="button"
							class={toolbarButtonClass()}
							aria-label="Redo"
							disabled={!canRedo()}
							onclick={() => runCommand((nextEditor) => nextEditor.chain().focus().redo().run())}
						>
							<IconArrowForwardUp class="h-4 w-4" />
						</button>
					</HoverTooltip>
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-2 border-t border-neutral-950/20 pt-2">
				<ListboxDropdown
					options={textBlockOptions}
					value={activeTextBlockStyle}
					ariaLabel="Paragraph and heading style"
					buttonClass="button-neutral-outlined h-9 min-w-[10.5rem] px-3 py-2 text-xs font-semibold cursor-pointer inline-flex items-center justify-between gap-2"
					listClass="mt-1 w-64 border-2 border-neutral-950 bg-white z-20 max-h-72 overflow-y-auto scrollbar-thin"
					on:change={(event) => {
						applyTextBlockStyle(event.detail.value as TextBlockStyle);
					}}
				>
					{#snippet trigger(open, selectedOption)}
						<span class={selectedOption?.labelClass ?? activeTextBlockOption.labelClass}>
							{selectedOption?.label ?? activeTextBlockOption.label}
						</span>
						{#if open}
							<IconChevronUp class="h-4 w-4 shrink-0" />
						{:else}
							<IconChevronDown class="h-4 w-4 shrink-0" />
						{/if}
					{/snippet}
				</ListboxDropdown>
				<ListboxDropdown
					options={fontFamilyOptions}
					value={toolbarState.fontFamily}
					ariaLabel="Font family"
					buttonClass="button-neutral-outlined h-9 min-w-[8.5rem] px-3 py-2 text-xs font-semibold cursor-pointer inline-flex items-center justify-between gap-2"
					listClass="mt-1 w-44 border-2 border-neutral-950 bg-white z-20 max-h-72 overflow-y-auto scrollbar-thin"
					optionClass="w-full text-left px-3 py-2 text-sm text-neutral-900 cursor-pointer"
					activeOptionClass="bg-neutral-100 text-neutral-900"
					on:change={(event) => {
						applyFontFamily(event.detail.value);
					}}
				>
					{#snippet trigger(open, selectedOption)}
						<span>{selectedOption?.label ?? activeFontFamilyOption.label}</span>
						{#if open}
							<IconChevronUp class="h-4 w-4 shrink-0" />
						{:else}
							<IconChevronDown class="h-4 w-4 shrink-0" />
						{/if}
					{/snippet}
				</ListboxDropdown>
				<div class={toolbarFontSizeShellClass()}>
					<button
						type="button"
						class={toolbarFontSizeButtonClass()}
						aria-label="Decrease font size"
						disabled={!editor}
						onclick={decreaseFontSize}
					>
						-
					</button>
					<input
						class={toolbarFontSizeInputClass()}
						type="number"
						min="10"
						max="72"
						step="1"
						inputmode="numeric"
						value={fontSizeInput}
						aria-label="Font size"
						oninput={handleFontSizeInput}
						onblur={() => syncFontSizeInputFromToolbar()}
					/>
					<button
						type="button"
						class={toolbarFontSizeButtonClass()}
						aria-label="Increase font size"
						disabled={!editor}
						onclick={increaseFontSize}
					>
						+
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="relative border border-neutral-950 bg-white cursor-text" onmousedown={focusEditorFromShell}>
		<div
			bind:this={editorElement}
			class="tiptap editor-host min-h-[22rem] max-w-none px-4 py-4 prose prose-neutral focus:outline-none"
		></div>

		{#if linkDialogOpen}
			<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/20 p-4">
				<div
					class="w-full max-w-md border-2 border-neutral-950 bg-neutral shadow-lg"
					role="dialog"
					aria-modal="true"
					aria-label="Edit hyperlink"
					tabindex="-1"
				>
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<h3 class="text-xl font-serif font-bold text-neutral-950">Edit hyperlink</h3>
						<p class="mt-1 text-sm text-neutral-700">
							Add, update, or remove the selected link without leaving the draft.
						</p>
					</div>
					<div class="space-y-3 p-4">
						<div class="space-y-2">
							<label class="block text-sm font-sans text-neutral-950" for="communication-link-url">
								Link URL
							</label>
							<input
								bind:this={linkInput}
								id="communication-link-url"
								class="input-secondary min-h-10"
								type="url"
								bind:value={linkValue}
								placeholder="https://example.com"
								onkeydown={(event) => {
									if (event.key !== 'Enter') {
										return;
									}

									event.preventDefault();
									applyLink();
								}}
							/>
						</div>
						<div class="flex flex-wrap items-center justify-end gap-2">
							<button
								type="button"
								class="button-neutral-outlined cursor-pointer"
								onclick={closeLinkDialog}
							>
								Cancel
							</button>
							<button
								type="button"
								class="button-secondary-outlined cursor-pointer"
								onclick={removeLink}
							>
								Remove Link
							</button>
							<button type="button" class="button-primary cursor-pointer" onclick={applyLink}>
								Apply Link
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if imageDialogOpen}
			<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/20 p-4">
				<div
					class="w-full max-w-lg border-2 border-neutral-950 bg-neutral shadow-lg"
					role="dialog"
					aria-modal="true"
					aria-label={imageIsSelected ? 'Edit image' : 'Insert image'}
					tabindex="-1"
				>
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<h3 class="text-xl font-serif font-bold text-neutral-950">
							{imageIsSelected ? 'Edit image' : 'Insert image'}
						</h3>
						<p class="mt-1 text-sm text-neutral-700">
							Use a remote image URL for newsletter content. Alt text helps accessibility and
							improves message clarity when images fail to load.
						</p>
					</div>
					<div class="space-y-3 p-4">
						<div class="space-y-2">
							<label class="block text-sm font-sans text-neutral-950" for="communication-image-url">
								Image URL
							</label>
							<input
								bind:this={imageInput}
								id="communication-image-url"
								class="input-secondary min-h-10"
								type="url"
								bind:value={imageUrl}
								placeholder="https://images.example.com/banner.png"
								onkeydown={(event) => {
									if (event.key !== 'Enter') {
										return;
									}

									event.preventDefault();
									applyImage();
								}}
							/>
						</div>
						<div class="grid gap-3 md:grid-cols-2">
							<div class="space-y-2">
								<label class="block text-sm font-sans text-neutral-950" for="communication-image-alt">
									Alt text
								</label>
								<input
									id="communication-image-alt"
									class="input-secondary min-h-10"
									type="text"
									bind:value={imageAlt}
									placeholder="Team huddle before opening night"
								/>
							</div>
							<div class="space-y-2">
								<label class="block text-sm font-sans text-neutral-950" for="communication-image-title">
									Title
								</label>
								<input
									id="communication-image-title"
									class="input-secondary min-h-10"
									type="text"
									bind:value={imageTitle}
									placeholder="Optional hover title"
								/>
							</div>
						</div>

						{#if imageError}
							<p class="border border-error-700 bg-error-100 px-3 py-2 text-sm text-error-800">
								{imageError}
							</p>
						{/if}

						<div class="flex flex-wrap items-center justify-end gap-2">
							<button
								type="button"
								class="button-neutral-outlined cursor-pointer"
								onclick={closeImageDialog}
							>
								Cancel
							</button>
							{#if imageIsSelected}
								<button
									type="button"
									class="button-secondary-outlined cursor-pointer"
									onclick={removeImage}
								>
									Remove Image
								</button>
							{/if}
							<button type="button" class="button-primary cursor-pointer" onclick={applyImage}>
								{imageIsSelected ? 'Update Image' : 'Insert Image'}
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if tableDialogOpen}
			<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/20 p-4">
				<div
					class="w-full max-w-md border-2 border-neutral-950 bg-neutral shadow-lg"
					role="dialog"
					aria-modal="true"
					aria-label="Insert table"
					tabindex="-1"
				>
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<h3 class="text-xl font-serif font-bold text-neutral-950">Insert table</h3>
						<p class="mt-1 text-sm text-neutral-700">
							Create a simple content table for schedules, highlights, or structured newsletter
							sections.
						</p>
					</div>
					<div class="space-y-3 p-4">
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="space-y-2">
								<label class="block text-sm font-sans text-neutral-950" for="communication-table-rows">
									Rows
								</label>
								<input
									id="communication-table-rows"
									class="input-secondary min-h-10"
									type="number"
									min="1"
									max="8"
									bind:value={tableRows}
								/>
							</div>
							<div class="space-y-2">
								<label class="block text-sm font-sans text-neutral-950" for="communication-table-cols">
									Columns
								</label>
								<input
									id="communication-table-cols"
									class="input-secondary min-h-10"
									type="number"
									min="1"
									max="8"
									bind:value={tableCols}
								/>
							</div>
						</div>
						<label class="inline-flex items-center gap-2 text-sm text-neutral-950">
							<input
								class="checkbox-secondary"
								type="checkbox"
								bind:checked={tableWithHeaderRow}
							/>
							<span>Start with a header row</span>
						</label>
						<div class="flex flex-wrap items-center justify-end gap-2">
							<button
								type="button"
								class="button-neutral-outlined cursor-pointer"
								onclick={closeTableDialog}
							>
								Cancel
							</button>
							<button type="button" class="button-primary cursor-pointer" onclick={applyTable}>
								Insert Table
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if specialCharacterDialogOpen}
			<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/20 p-4">
				<div
					class="w-full max-w-3xl max-h-full border-2 border-neutral-950 bg-neutral shadow-lg overflow-hidden flex flex-col"
					role="dialog"
					aria-modal="true"
					aria-label="Special characters"
					tabindex="-1"
				>
					<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
						<div class="flex items-center justify-between gap-3">
							<h3 class="min-w-0 text-2xl font-serif font-bold text-neutral-950">
								Special Characters
							</h3>
							<button
								type="button"
								class="modal-close-button shrink-0"
								aria-label="Close special characters"
								onclick={closeSpecialCharacterDialog}
							>
								<IconX class="h-6 w-6" />
							</button>
						</div>
					</div>

					<div class="flex flex-1 flex-col overflow-hidden bg-neutral">
						<div class="space-y-4 overflow-y-auto p-4">
							<div class="communication-editor-special-character-grid">
								{#each communicationEditorSpecialCharacters as option, optionIndex (option.value)}
									<HoverTooltip text={option.label} case="preserve" wrapperClass="block">
										<button
											type="button"
											class="communication-editor-special-character-button"
											data-special-character-index={optionIndex}
											aria-label={`Select ${option.label}`}
											onclick={() => {
												insertSpecialCharacter(option.value);
											}}
										>
											<span aria-hidden="true">{option.value}</span>
										</button>
									</HoverTooltip>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.communication-rich-editor :global(.communication-editor-text-style-preview) {
		display: block;
		width: 100%;
		text-align: left;
		color: inherit;
	}

	.communication-rich-editor :global(.communication-editor-text-style-preview-paragraph) {
		font-size: 0.95rem;
		font-weight: 500;
		line-height: 1.4;
	}

	.communication-rich-editor :global(.communication-editor-text-style-preview-h1) {
		font-family: 'Bitter', serif;
		font-size: 1.55rem;
		font-weight: 700;
		line-height: 1.05;
	}

	.communication-rich-editor :global(.communication-editor-text-style-preview-h2) {
		font-family: 'Bitter', serif;
		font-size: 1.2rem;
		font-weight: 700;
		line-height: 1.1;
	}

	.communication-rich-editor :global(.communication-editor-text-style-preview-h3) {
		font-family: 'Bitter', serif;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.15;
	}

	.communication-rich-editor :global(.communication-editor-color-tool) {
		position: relative;
		min-width: 2.5rem;
	}

	.communication-rich-editor :global(.communication-editor-color-tool-icon) {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		color: var(--color-neutral-950);
	}

	.communication-rich-editor :global(.communication-editor-color-tool-preview) {
		position: absolute;
		left: 0.05rem;
		right: 0.05rem;
		bottom: -0.22rem;
		height: 0.18rem;
		border-radius: 999px;
	}

	.communication-rich-editor :global(.communication-editor-color-tool-input) {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.communication-rich-editor :global(.communication-editor-font-size-input::-webkit-outer-spin-button),
	.communication-rich-editor :global(.communication-editor-font-size-input::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}

	.communication-rich-editor :global(.communication-editor-font-size-input) {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.communication-rich-editor :global(.communication-editor-special-character-grid) {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.communication-rich-editor :global(.communication-editor-special-character-button) {
		display: inline-flex;
		width: 100%;
		min-height: 2.45rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-neutral-950);
		background: white;
		color: var(--color-neutral-950);
		font-size: 1.05rem;
		line-height: 1;
		cursor: pointer;
		transition:
			background-color 120ms ease,
			color 120ms ease,
			border-color 120ms ease;
	}

	.communication-rich-editor :global(.communication-editor-special-character-button:hover) {
		background: color-mix(in srgb, var(--color-secondary-100) 72%, white);
	}

	.communication-rich-editor :global(.communication-editor-special-character-button:focus-visible) {
		outline: 2px solid var(--color-primary-600);
		outline-offset: 2px;
	}

	@media (min-width: 640px) {
		.communication-rich-editor :global(.communication-editor-special-character-grid) {
			grid-template-columns: repeat(8, minmax(0, 1fr));
		}
	}

	@media (min-width: 1024px) {
		.communication-rich-editor :global(.communication-editor-special-character-grid) {
			grid-template-columns: repeat(11, minmax(0, 1fr));
		}
	}

	.communication-rich-editor :global(.editor-host),
	.communication-rich-editor :global(.tiptap) {
		min-height: 22rem;
		outline: none !important;
		border: 0 !important;
		box-shadow: none !important;
		color: var(--color-neutral-950);
		font-size: 0.95rem;
		line-height: 1.35;
	}

	.communication-rich-editor :global(.editor-host .ProseMirror) {
		min-height: calc(22rem - 2rem);
		cursor: text;
	}

	.communication-rich-editor :global(.editor-host:focus),
	.communication-rich-editor :global(.editor-host:focus-visible),
	.communication-rich-editor :global(.editor-host.ProseMirror-focused),
	.communication-rich-editor :global(.tiptap:focus),
	.communication-rich-editor :global(.tiptap:focus-visible),
	.communication-rich-editor :global(.tiptap.ProseMirror-focused) {
		outline: none !important;
		outline-offset: 0 !important;
		border: 0 !important;
		border-color: transparent !important;
		box-shadow: none !important;
		--tw-ring-color: transparent !important;
		--tw-ring-shadow: 0 0 #0000 !important;
	}

	.communication-rich-editor :global(.tiptap > *:first-child) {
		margin-top: 0;
	}

	.communication-rich-editor :global(.tiptap p) {
		margin: 0 0 0.5rem;
	}

	.communication-rich-editor :global(.tiptap h1) {
		font-family: 'Bitter', serif;
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.05;
		margin: 0 0 1rem;
	}

	.communication-rich-editor :global(.tiptap h2) {
		font-family: 'Bitter', serif;
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.1;
		margin: 1.25rem 0 0.9rem;
	}

	.communication-rich-editor :global(.tiptap h3) {
		font-family: 'Bitter', serif;
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.2;
		margin: 1rem 0 0.75rem;
	}

	.communication-rich-editor :global(.tiptap ul) {
		list-style: disc outside;
		margin: 0 0 1rem 1.5rem;
		padding-left: 0.5rem;
	}

	.communication-rich-editor :global(.tiptap ol) {
		list-style: decimal outside;
		margin: 0 0 1rem 1.5rem;
		padding-left: 0.5rem;
	}

	.communication-rich-editor :global(.tiptap li) {
		margin: 0.2rem 0;
	}

	.communication-rich-editor :global(.tiptap li > p) {
		margin: 0;
	}

	.communication-rich-editor :global(.tiptap blockquote) {
		border-left: 4px solid var(--color-secondary-500);
		margin: 1rem 0;
		padding: 0.1rem 0 0.1rem 1rem;
		color: var(--color-neutral-800);
		background: color-mix(in srgb, var(--color-secondary-100) 40%, white);
	}

	.communication-rich-editor :global(.tiptap a) {
		color: #2563eb;
		text-decoration: underline;
		cursor: pointer;
	}

	.communication-rich-editor :global(.tiptap a:hover) {
		color: #1d4ed8;
	}

	.communication-rich-editor :global(.tiptap img) {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 1.25rem auto;
	}

	.communication-rich-editor :global(.tiptap img.ProseMirror-selectednode) {
		outline: 2px solid var(--color-secondary-500);
	}

	.communication-rich-editor :global(.tiptap .tableWrapper) {
		margin: 1.25rem 0;
		overflow-x: auto;
	}

	.communication-rich-editor :global(.tiptap table) {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		border: 2px solid var(--color-neutral-950);
	}

	.communication-rich-editor :global(.tiptap th) {
		border: 1px solid var(--color-neutral-950);
		background: var(--color-secondary-100);
		padding: 0.7rem 0.8rem;
		text-align: left;
		vertical-align: top;
		font-weight: 700;
	}

	.communication-rich-editor :global(.tiptap td) {
		border: 1px solid var(--color-neutral-950);
		padding: 0.7rem 0.8rem;
		text-align: left;
		vertical-align: top;
	}

	.communication-rich-editor :global(.tiptap .selectedCell) {
		position: relative;
	}

	.communication-rich-editor :global(.tiptap .selectedCell::after) {
		content: '';
		pointer-events: none;
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--color-secondary-300) 28%, transparent);
	}

	.communication-rich-editor :global(.tiptap .column-resize-handle) {
		position: absolute;
		top: 0;
		right: -2px;
		bottom: -2px;
		width: 4px;
		background: var(--color-secondary-600);
	}
</style>
