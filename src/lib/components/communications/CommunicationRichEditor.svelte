<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
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
		IconH1,
		IconItalic,
		IconLink,
		IconList,
		IconListNumbers,
		IconUnderline
	} from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import { resolveCommunicationEditorShortcut } from '$lib/communications/editor-shortcuts.js';

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

	type CommunicationEditorShortcut = NonNullable<
		ReturnType<typeof resolveCommunicationEditorShortcut>
	>;

	let {
		initialHtml = '',
		initialJson = null,
		editable = true,
		onChange = null
	}: Props = $props();

	let rootElement = $state<HTMLDivElement | null>(null);
	let editorHost = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);
	let linkDialogOpen = $state(false);
	let linkValue = $state('');
	let linkInput = $state<HTMLInputElement | null>(null);
	let textColor = $state('#14213d');
	let highlightColor = $state('#eedbce');
	let lastAppliedSignature = $state('');

	const buildSignature = (html: string, json: Record<string, unknown> | null): string =>
		JSON.stringify({ html, json });

	const emitChange = (): void => {
		if (!editor) {
			return;
		}

		onChange?.({
			html: editor.getHTML(),
			json: editor.getJSON() as Record<string, unknown>,
			text: editor.getText()
		});
	};

	const applyContentIfNeeded = (): void => {
		if (!editor) {
			return;
		}

		const nextSignature = buildSignature(initialHtml, initialJson);
		if (nextSignature === lastAppliedSignature) {
			return;
		}

		lastAppliedSignature = nextSignature;
		if (initialJson) {
			editor.commands.setContent(initialJson, { emitUpdate: false });
			return;
		}
		editor.commands.setContent(initialHtml || '<p></p>', { emitUpdate: false });
	};

	function toolbarButtonClass(active = false): string {
		return [
			'button-neutral-outlined min-h-9 min-w-9 px-2 py-2 text-xs font-semibold cursor-pointer justify-center',
			active ? 'bg-secondary-100 border-secondary-700' : ''
		].join(' ');
	}

	function runCommand(command: () => void): void {
		if (!editor || !editable) {
			return;
		}
		command();
	}

	function toggleHeading(): void {
		runCommand(() => {
			if (!editor) {
				return;
			}
			const chain = editor.chain().focus();
			if (editor.isActive('heading', { level: 2 })) {
				chain.setParagraph().run();
				return;
			}
			chain.toggleHeading({ level: 2 }).run();
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
		runCommand(() => {
			if (!editor) {
				return;
			}

			const value = linkValue.trim();
			if (!value) {
				editor.chain().focus().unsetLink().run();
				closeLinkDialog();
				return;
			}

			editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
			closeLinkDialog();
		});
	}

	function removeLink(): void {
		runCommand(() => {
			editor?.chain().focus().unsetLink().run();
			closeLinkDialog();
		});
	}

	function applyTextColor(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		textColor = value;
		runCommand(() => {
			editor?.chain().focus().setColor(value).run();
		});
	}

	function applyHighlightColor(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;
		highlightColor = value;
		runCommand(() => {
			editor?.chain().focus().setHighlight({ color: value }).run();
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
				editor.chain().focus().setTextSelection({ from, to: from + textLength }).run();
			} else {
				editor.chain().focus().setTextSelection(from).run();
			}
			editor.chain().focus().extendMarkRange('link').run();
		} catch {
			editor.commands.focus();
		}
	}

	function executeShortcut(shortcut: CommunicationEditorShortcut): void {
		switch (shortcut) {
			case 'bold':
				runCommand(() => editor?.chain().focus().toggleBold().run());
				return;
			case 'italic':
				runCommand(() => editor?.chain().focus().toggleItalic().run());
				return;
			case 'underline':
				runCommand(() => editor?.chain().focus().toggleUnderline().run());
				return;
			case 'bulletList':
				runCommand(() => editor?.chain().focus().toggleBulletList().run());
				return;
			case 'orderedList':
				runCommand(() => editor?.chain().focus().toggleOrderedList().run());
				return;
			case 'undo':
				runCommand(() => editor?.chain().focus().undo().run());
				return;
			case 'redo':
				runCommand(() => editor?.chain().focus().redo().run());
				return;
			case 'link':
				runCommand(() => {
					openLinkDialog();
				});
				return;
		}
	}

	function handleEditorKeydown(event: KeyboardEvent): void {
		const shortcut = resolveCommunicationEditorShortcut(event);
		if (!shortcut) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation?.();
		executeShortcut(shortcut);
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
		if (!editorHost) {
			return;
		}

		editor = new Editor({
			element: editorHost,
			editable,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [2, 3]
					}
				}),
				Underline,
				TextStyle,
				Color,
				Highlight.configure({ multicolor: true }),
				Link.configure({
					openOnClick: false,
					autolink: true,
					defaultProtocol: 'https'
				})
			],
			content: initialJson ?? initialHtml ?? '<p></p>',
			onUpdate: () => {
				emitChange();
			}
		});
		lastAppliedSignature = buildSignature(initialHtml, initialJson);

		rootElement?.addEventListener('keydown', handleEditorKeydown);
		rootElement?.addEventListener('click', handleEditorClick);

		return () => {
			rootElement?.removeEventListener('keydown', handleEditorKeydown);
			rootElement?.removeEventListener('click', handleEditorClick);
			editor?.destroy();
			editor = null;
		};
	});

	onDestroy(() => {
		rootElement?.removeEventListener('keydown', handleEditorKeydown);
		rootElement?.removeEventListener('click', handleEditorClick);
		editor?.destroy();
		editor = null;
	});

	$effect(() => {
		if (!editor) {
			return;
		}
		editor.setEditable(editable);
	});

	$effect(() => {
		applyContentIfNeeded();
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
			<HoverTooltip text="Bold" shortcutKeys={['Mod', 'B']}>
				<button type="button" class={toolbarButtonClass(editor?.isActive('bold') ?? false)} aria-label="Bold" onclick={() => runCommand(() => editor?.chain().focus().toggleBold().run())}>
					<IconBold class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Italic" shortcutKeys={['Mod', 'I']}>
				<button type="button" class={toolbarButtonClass(editor?.isActive('italic') ?? false)} aria-label="Italic" onclick={() => runCommand(() => editor?.chain().focus().toggleItalic().run())}>
					<IconItalic class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Underline" shortcutKeys={['Mod', 'U']}>
				<button type="button" class={toolbarButtonClass(editor?.isActive('underline') ?? false)} aria-label="Underline" onclick={() => runCommand(() => editor?.chain().focus().toggleUnderline().run())}>
					<IconUnderline class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Bulleted list" shortcutKeys={['Mod', 'Shift', '8']}>
				<button type="button" class={toolbarButtonClass(editor?.isActive('bulletList') ?? false)} aria-label="Bulleted list" onclick={() => runCommand(() => editor?.chain().focus().toggleBulletList().run())}>
					<IconList class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Numbered list" shortcutKeys={['Mod', 'Shift', '7']}>
				<button type="button" class={toolbarButtonClass(editor?.isActive('orderedList') ?? false)} aria-label="Numbered list" onclick={() => runCommand(() => editor?.chain().focus().toggleOrderedList().run())}>
					<IconListNumbers class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Blockquote">
				<button type="button" class={toolbarButtonClass(editor?.isActive('blockquote') ?? false)} aria-label="Blockquote" onclick={() => runCommand(() => editor?.chain().focus().toggleBlockquote().run())}>
					<IconBlockquote class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Heading">
				<button type="button" class={toolbarButtonClass(editor?.isActive('heading', { level: 2 }) ?? false)} aria-label="Heading" onclick={toggleHeading}>
					<IconH1 class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Hyperlink" shortcutKeys={['Mod', 'K']}>
				<button type="button" class={toolbarButtonClass(editor?.isActive('link') ?? false)} aria-label="Hyperlink" onclick={() => openLinkDialog()}>
					<IconLink class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Text color">
				<label class="button-neutral-outlined min-h-9 px-2 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-2">
					<IconColorFilter class="h-4 w-4" />
					<span>Text</span>
					<input class="h-5 w-5 cursor-pointer" type="color" value={textColor} oninput={applyTextColor} />
				</label>
			</HoverTooltip>
			<HoverTooltip text="Highlight color">
				<label class="button-neutral-outlined min-h-9 px-2 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-2">
					<span class="inline-flex h-4 w-4 border border-neutral-950 bg-warning-100"></span>
					<span>Highlight</span>
					<input class="h-5 w-5 cursor-pointer" type="color" value={highlightColor} oninput={applyHighlightColor} />
				</label>
			</HoverTooltip>
			<HoverTooltip text="Clear formatting">
				<button type="button" class={toolbarButtonClass()} aria-label="Clear formatting" onclick={() => runCommand(() => editor?.chain().focus().unsetAllMarks().clearNodes().run())}>
					<IconClearFormatting class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Undo" shortcutKeys={['Mod', 'Z']}>
				<button type="button" class={toolbarButtonClass()} aria-label="Undo" onclick={() => runCommand(() => editor?.chain().focus().undo().run())}>
					<IconArrowBackUp class="h-4 w-4" />
				</button>
			</HoverTooltip>
			<HoverTooltip text="Redo" shortcutKeys={['Mod', 'Shift', 'Z']}>
				<button type="button" class={toolbarButtonClass()} aria-label="Redo" onclick={() => runCommand(() => editor?.chain().focus().redo().run())}>
					<IconArrowForwardUp class="h-4 w-4" />
				</button>
			</HoverTooltip>
		</div>
	{/if}

	<div class="border border-neutral-950 bg-white relative">
		<div bind:this={editorHost} class="editor-host min-h-[18rem] px-4 py-3"></div>

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
							<button type="button" class="button-neutral-outlined cursor-pointer" onclick={closeLinkDialog}>
								Cancel
							</button>
							<button type="button" class="button-secondary-outlined cursor-pointer" onclick={removeLink}>
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
	.communication-rich-editor :global(.ProseMirror) {
		min-height: 18rem;
		outline: none;
		color: var(--color-neutral-950);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.communication-rich-editor :global(.ProseMirror p) {
		margin: 0 0 0.85rem;
	}

	.communication-rich-editor :global(.ProseMirror h2) {
		font-family: 'Bitter', serif;
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 1.1;
		margin: 0 0 0.85rem;
	}

	.communication-rich-editor :global(.ProseMirror h3) {
		font-family: 'Bitter', serif;
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.15;
		margin: 0 0 0.75rem;
	}

	.communication-rich-editor :global(.ProseMirror ul) {
		list-style: disc outside;
		margin: 0 0 0.85rem 1.5rem;
		padding-left: 0.5rem;
	}

	.communication-rich-editor :global(.ProseMirror ol) {
		list-style: decimal outside;
		margin: 0 0 0.85rem 1.5rem;
		padding-left: 0.5rem;
	}

	.communication-rich-editor :global(.ProseMirror li) {
		margin: 0.2rem 0;
	}

	.communication-rich-editor :global(.ProseMirror li > p) {
		margin: 0;
	}

	.communication-rich-editor :global(.ProseMirror blockquote) {
		border-left: 4px solid var(--color-secondary-500);
		margin: 0 0 0.85rem;
		padding-left: 0.9rem;
		color: var(--color-neutral-800);
	}

	.communication-rich-editor :global(.ProseMirror a) {
		color: var(--color-primary-700);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
