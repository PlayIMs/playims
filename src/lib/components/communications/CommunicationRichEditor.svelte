<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { Editor, Extension } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Highlight from '@tiptap/extension-highlight';
	import { TextStyle } from '@tiptap/extension-text-style';
	import Color from '@tiptap/extension-color';
	import {
		IconArrowBackUp,
		IconArrowForwardUp,
		IconBlockquote,
		IconBold,
		IconClearFormatting,
		IconColorFilter,
		IconItalic,
		IconLink,
		IconList,
		IconListNumbers,
		IconUnderline
	} from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import ListboxDropdown from '$lib/components/ListboxDropdown.svelte';
	import {
		buildCommunicationEditorContentSignature,
		getCommunicationEditorInitialContent
	} from '$lib/communications/editor-content.js';

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

	type TextBlockStyle = 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3';

	let { initialHtml = '', initialJson = null, editable = true, onChange = null }: Props = $props();

	let rootElement = $state<HTMLDivElement | null>(null);
	let editorElement = $state<HTMLDivElement | null>(null);
	let editorState = $state<{ editor: Editor | null }>({ editor: null });
	let linkDialogOpen = $state(false);
	let linkValue = $state('');
	let linkInput = $state<HTMLInputElement | null>(null);
	let textColor = $state('#14213d');
	let highlightColor = $state('#eedbce');
	let lastAppliedSignature = $state('');
	const defaultLinkColor = '#2563eb';
	const textBlockOptions = [
		{ value: 'paragraph', label: 'Paragraph', description: 'Standard body text.' },
		{ value: 'heading-1', label: 'Heading 1', description: 'Primary section heading.' },
		{ value: 'heading-2', label: 'Heading 2', description: 'Major subsection heading.' },
		{ value: 'heading-3', label: 'Heading 3', description: 'Minor subsection heading.' }
	];

	const editor = $derived(editorState.editor);
	const activeTextBlockStyle = $derived.by<TextBlockStyle>(() => {
		if (editor?.isActive('heading', { level: 1 })) {
			return 'heading-1';
		}
		if (editor?.isActive('heading', { level: 2 })) {
			return 'heading-2';
		}
		if (editor?.isActive('heading', { level: 3 })) {
			return 'heading-3';
		}
		return 'paragraph';
	});

	const emitChange = (nextEditor: Editor): void => {
		onChange?.({
			html: nextEditor.getHTML(),
			json: nextEditor.getJSON() as Record<string, unknown>,
			text: nextEditor.getText()
		});
	};

	const setEditorState = (nextEditor: Editor | null): void => {
		editorState = { editor: nextEditor };
	};

	function toolbarButtonClass(active = false): string {
		return [
			'button-neutral-outlined min-h-9 min-w-9 px-2 py-2 text-xs font-semibold cursor-pointer justify-center',
			active ? 'bg-secondary-100 border-secondary-700' : ''
		].join(' ');
	}

	function runCommand(command: (nextEditor: Editor) => void): void {
		if (!editor || !editable) {
			return;
		}

		command(editor);
		setEditorState(editor);
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

	function openLinkDialog(value?: string): void {
		if (!editable) {
			return;
		}

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

			nextEditor
				.chain()
				.focus()
				.extendMarkRange('link')
				.setColor(defaultLinkColor)
				.setLink({ href: value })
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

	function handleEditorClick(event: MouseEvent): void {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !editable) {
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
					link: {
						openOnClick: false,
						autolink: true,
						defaultProtocol: 'https'
					}
				}),
				communicationKeyboardShortcuts,
				TextStyle,
				Color,
				Highlight.configure({ multicolor: true })
			],
			content: getCommunicationEditorInitialContent({ initialHtml, initialJson }),
			onUpdate: ({ editor: updatedEditor }) => {
				emitChange(updatedEditor);
			},
			onTransaction: ({ editor: updatedEditor }) => {
				// Replacing the editor reference is the official Svelte runes pattern for fresh active-state UI.
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
		setEditorState(editor);
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
		setEditorState(editor);
	});

	$effect(() => {
		if (!linkDialogOpen || typeof window === 'undefined') {
			return;
		}

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			closeLinkDialog();
		};

		window.addEventListener('keydown', handleWindowKeydown, true);
		return () => {
			window.removeEventListener('keydown', handleWindowKeydown, true);
		};
	});
</script>

<div
	bind:this={rootElement}
	class="section-card p-3 space-y-3 communication-rich-editor relative"
	data-communication-editor-root
>
	{#if editable}
		<div class="flex flex-wrap gap-2 border border-neutral-950 bg-neutral-50 p-2">
			<ListboxDropdown
				options={textBlockOptions}
				value={activeTextBlockStyle}
				ariaLabel="Paragraph and heading style"
				buttonClass="button-neutral-outlined min-h-9 min-w-[11rem] px-3 py-2 text-xs font-semibold cursor-pointer inline-flex items-center justify-between gap-2"
				listClass="mt-1 w-64 border-2 border-neutral-950 bg-white z-20 max-h-72 overflow-y-auto scrollbar-thin"
				on:change={(event) => {
					applyTextBlockStyle(event.detail.value as TextBlockStyle);
				}}
			/>
			<HoverTooltip text="Bold" shortcutKeys={['Mod', 'B']}>
				<button
					type="button"
					class={toolbarButtonClass(editor?.isActive('bold') ?? false)}
					aria-label="Bold"
					onclick={() => runCommand((nextEditor) => nextEditor.chain().focus().toggleBold().run())}
				>
					<IconBold class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Italic" shortcutKeys={['Mod', 'I']}>
				<button
					type="button"
					class={toolbarButtonClass(editor?.isActive('italic') ?? false)}
					aria-label="Italic"
					onclick={() =>
						runCommand((nextEditor) => nextEditor.chain().focus().toggleItalic().run())}
				>
					<IconItalic class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Underline" shortcutKeys={['Mod', 'U']}>
				<button
					type="button"
					class={toolbarButtonClass(editor?.isActive('underline') ?? false)}
					aria-label="Underline"
					onclick={() =>
						runCommand((nextEditor) => nextEditor.chain().focus().toggleUnderline().run())}
				>
					<IconUnderline class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Bulleted list" shortcutKeys={['Mod', 'Shift', '8']}>
				<button
					type="button"
					class={toolbarButtonClass(editor?.isActive('bulletList') ?? false)}
					aria-label="Bulleted list"
					onclick={() =>
						runCommand((nextEditor) => nextEditor.chain().focus().toggleBulletList().run())}
				>
					<IconList class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Numbered list" shortcutKeys={['Mod', 'Shift', '7']}>
				<button
					type="button"
					class={toolbarButtonClass(editor?.isActive('orderedList') ?? false)}
					aria-label="Numbered list"
					onclick={() =>
						runCommand((nextEditor) => nextEditor.chain().focus().toggleOrderedList().run())}
				>
					<IconListNumbers class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Blockquote">
				<button
					type="button"
					class={toolbarButtonClass(editor?.isActive('blockquote') ?? false)}
					aria-label="Blockquote"
					onclick={() =>
						runCommand((nextEditor) => nextEditor.chain().focus().toggleBlockquote().run())}
				>
					<IconBlockquote class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Hyperlink" shortcutKeys={['Mod', 'K']}>
				<button
					type="button"
					class={toolbarButtonClass(editor?.isActive('link') ?? false)}
					aria-label="Hyperlink"
					onclick={() => openLinkDialog()}
				>
					<IconLink class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Text color">
				<label
					class="button-neutral-outlined min-h-9 px-2 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
				>
					<IconColorFilter class="h-4 w-4" />
					<span>Text</span>
					<input
						class="h-5 w-5 cursor-pointer"
						type="color"
						value={textColor}
						oninput={applyTextColor}
					/>
				</label>
			</HoverTooltip>
			<HoverTooltip text="Highlight color">
				<label
					class="button-neutral-outlined min-h-9 px-2 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
				>
					<span class="inline-flex h-4 w-4 border border-neutral-950 bg-warning-100"></span>
					<span>Highlight</span>
					<input
						class="h-5 w-5 cursor-pointer"
						type="color"
						value={highlightColor}
						oninput={applyHighlightColor}
					/>
				</label>
			</HoverTooltip>
			<HoverTooltip text="Clear formatting">
				<button
					type="button"
					class={toolbarButtonClass()}
					aria-label="Clear formatting"
					onclick={() =>
						runCommand((nextEditor) =>
							nextEditor.chain().focus().unsetAllMarks().clearNodes().run()
						)}
				>
					<IconClearFormatting class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Undo" shortcutKeys={['Mod', 'Z']}>
				<button
					type="button"
					class={toolbarButtonClass()}
					aria-label="Undo"
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
					onclick={() => runCommand((nextEditor) => nextEditor.chain().focus().redo().run())}
				>
					<IconArrowForwardUp class="h-4 w-4" />
				</button>
			</HoverTooltip>
		</div>
	{/if}

	<div class="border border-neutral-950 bg-white relative">
		<div
			bind:this={editorElement}
			class="tiptap editor-host min-h-[18rem] max-w-none px-4 py-3 prose prose-neutral focus:outline-none"
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
					<div class="p-4 space-y-3">
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
	</div>
</div>

<style>
	.communication-rich-editor :global(.tiptap) {
		min-height: 18rem;
		outline: none;
		color: var(--color-neutral-950);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.communication-rich-editor :global(.tiptap p) {
		margin: 0 0 0.85rem;
	}

	.communication-rich-editor :global(.tiptap h1) {
		font-family: 'Bitter', serif;
		font-size: 1.9rem;
		font-weight: 700;
		line-height: 1;
		margin: 0 0 0.95rem;
	}

	.communication-rich-editor :global(.tiptap h2) {
		font-family: 'Bitter', serif;
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 1.1;
		margin: 0 0 0.85rem;
	}

	.communication-rich-editor :global(.tiptap h3) {
		font-family: 'Bitter', serif;
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.15;
		margin: 0 0 0.75rem;
	}

	.communication-rich-editor :global(.tiptap ul) {
		list-style: disc outside;
		margin: 0 0 0.85rem 1.5rem;
		padding-left: 0.5rem;
	}

	.communication-rich-editor :global(.tiptap ol) {
		list-style: decimal outside;
		margin: 0 0 0.85rem 1.5rem;
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
		margin: 0 0 0.85rem;
		padding-left: 0.9rem;
		color: var(--color-neutral-800);
	}

	.communication-rich-editor :global(.tiptap a) {
		color: #2563eb;
		text-decoration: underline;
		cursor: pointer;
	}

	.communication-rich-editor :global(.tiptap a:hover) {
		color: #1d4ed8;
	}

	.communication-rich-editor :global(.tiptap.ProseMirror-selectednode) {
		outline: 2px solid var(--color-secondary-500);
	}
</style>
