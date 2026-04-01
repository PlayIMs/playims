<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import {
		IconDeviceFloppy,
		IconInfoCircle,
		IconLock,
		IconRestore,
		IconShieldCheck,
		IconUsersGroup,
		IconWorldWww
	} from '@tabler/icons-svelte';
	import HoverTooltip from '$lib/components/HoverTooltip.svelte';
	import InfoPopover from '$lib/components/InfoPopover.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import type { PageProps } from './$types';

	type OrganizationSaveFailure = {
		action?: string;
		error?: string;
		fieldErrors?: Record<string, string>;
	};

	type OrganizationSaveSuccess = {
		action?: string;
		success?: string;
	};

	type OrganizationState = {
		organizationName: string;
		organizationSlug: string;
		selfJoinEnabled: boolean;
		metadata: string;
	};

	let { data, form }: PageProps = $props();

	const normalizeSlug = (value: string): string =>
		value
			.toLowerCase()
			.trim()
			.replace(/['"]/g, '')
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');

	const createStateFromData = (): OrganizationState => ({
		organizationName: data.organization?.name ?? '',
		organizationSlug: data.organization?.slug ?? '',
		selfJoinEnabled: data.organization?.selfJoinEnabled ?? false,
		metadata: data.organization?.metadata ?? ''
	});

	const serializeState = (value: OrganizationState): string =>
		JSON.stringify({
			organizationName: value.organizationName.trim(),
			organizationSlug: normalizeSlug(value.organizationSlug),
			selfJoinEnabled: value.selfJoinEnabled,
			metadata: value.metadata.trim()
		});

	const formatTimestamp = (value: string | null): string => {
		if (!value) {
			return 'Not available';
		}

		const timestamp = Date.parse(value);
		if (!Number.isFinite(timestamp)) {
			return value;
		}

		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(timestamp));
	};

	const metadataPlaceholder = '{"contactEmail":"rec@playims.test","timezone":"America/Chicago"}';

	let organizationForm = $state<OrganizationState>(createStateFromData());
	let saveSubmitting = $state(false);
	let lastSyncedSignature = $state(serializeState(createStateFromData()));

	const loadedState = $derived.by(() => createStateFromData());
	const loadedSignature = $derived.by(() => serializeState(loadedState));
	const settingsTitle = $derived.by(() => data.navigationLabels?.settings ?? 'Settings');
	const pageTitle = $derived.by(() => `${settingsTitle}: Organization`);
	const currentSlug = $derived.by(() => normalizeSlug(organizationForm.organizationSlug));
	const joinPath = $derived.by(() => (currentSlug ? `/${currentSlug}` : '/organization-slug'));
	const hasUnsavedChanges = $derived.by(
		() => serializeState(organizationForm) !== serializeState(loadedState)
	);
	const saveFailure = $derived.by(() =>
		form?.action === 'saveOrganization' ? (form as OrganizationSaveFailure) : undefined
	);
	const saveSuccess = $derived.by(() =>
		form?.action === 'saveOrganization' ? (form as OrganizationSaveSuccess) : undefined
	);
	const fieldErrors = $derived.by(() => saveFailure?.fieldErrors ?? {});
	const metadataCharacterCount = $derived.by(() => organizationForm.metadata.length);
	const metadataMode = $derived.by(() => {
		const trimmed = organizationForm.metadata.trim();
		if (!trimmed) {
			return 'empty';
		}

		try {
			JSON.parse(trimmed);
			return 'json';
		} catch {
			return 'text';
		}
	});

	$effect(() => {
		if (loadedSignature === lastSyncedSignature || saveSubmitting) {
			return;
		}

		organizationForm = createStateFromData();
		lastSyncedSignature = loadedSignature;
	});

	const resetForm = (): void => {
		organizationForm = createStateFromData();
	};

	const enhanceSaveOrganization = () => {
		return async ({
			result,
			update
		}: {
			result: ActionResult;
			update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			saveSubmitting = false;

			if (result.type === 'redirect' || result.type === 'error') {
				await applyAction(result);
				return;
			}

			await update({
				reset: false,
				invalidateAll: result.type === 'success'
			});

			if (result.type === 'success') {
				lastSyncedSignature = serializeState(createStateFromData());
			}
		};
	};
</script>

<PageTitle {pageTitle} />

<svelte:head>
	<meta
		name="description"
		content="Review and update core organization identity, join, and metadata settings."
	/>
</svelte:head>

<div class="dashboard-page-shell">
	{#if data.error || !data.organization}
		<section class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-3">
			<div class="flex items-start gap-3">
				<div
					class="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-error-700 bg-error-50 text-error-800"
					aria-hidden="true"
				>
					<IconInfoCircle class="h-5 w-5" />
				</div>
				<div class="space-y-1">
					<h2 class="text-2xl font-bold font-serif text-neutral-950">Organization</h2>
					<p class="text-sm text-neutral-950">
						{data.error ?? 'Unable to load the active organization.'}
					</p>
				</div>
			</div>
		</section>
	{:else}
		<section class="space-y-4">
			<div class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-4">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div class="space-y-2">
						<div class="flex items-center gap-3">
							<div
								class="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-primary-700 bg-primary text-primary-foreground"
								aria-hidden="true"
							>
								<IconShieldCheck class="h-6 w-6" />
							</div>
							<div>
								<p class="text-xs font-bold uppercase tracking-[0.16em] text-secondary-700">
									Organization Profile
								</p>
								<h2 class="font-serif text-3xl leading-none text-neutral-950">
									{data.organization.name}
								</h2>
							</div>
						</div>
						<p class="max-w-3xl text-sm leading-6 text-neutral-950">
							These settings control the active organization's name, URL slug, join behavior, and
							stored metadata. The page only exposes fields the current data model already supports.
						</p>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<HoverTooltip text="Reset unsaved changes">
							<button
								type="button"
								class="button-secondary-outlined inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
								disabled={!hasUnsavedChanges || saveSubmitting}
								onclick={resetForm}
							>
								<IconRestore class="h-4 w-4" />
								<span>Reset</span>
							</button>
						</HoverTooltip>

						<HoverTooltip text="Save organization settings">
							<button
								type="submit"
								form="organization-settings-form"
								class="button-primary inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
								disabled={!data.canEditOrganization || !hasUnsavedChanges || saveSubmitting}
							>
								<IconDeviceFloppy class={`h-4 w-4 ${saveSubmitting ? 'animate-pulse' : ''}`} />
								<span>{saveSubmitting ? 'Saving...' : 'Save Changes'}</span>
							</button>
						</HoverTooltip>
					</div>
				</div>

				{#if saveFailure?.error}
					<div class="border-2 border-error-700 bg-error-50 p-3 text-sm text-error-900">
						{saveFailure.error}
					</div>
				{/if}

				{#if saveSuccess?.success}
					<div class="border-2 border-success-700 bg-success-50 p-3 text-sm text-success-900">
						{saveSuccess.success}
					</div>
				{/if}

				{#if data.readOnlyMessage}
					<div class="border-2 border-secondary-300 bg-white p-3">
						<div class="flex items-start gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-950 bg-neutral text-neutral-950"
								aria-hidden="true"
							>
								<IconLock class="h-4 w-4" />
							</div>
							<div class="space-y-1">
								<p class="text-sm font-semibold text-neutral-950">Read-only mode</p>
								<p class="text-sm text-neutral-950">{data.readOnlyMessage}</p>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
				<form
					id="organization-settings-form"
					method="POST"
					action="?/saveOrganization"
					use:enhance={enhanceSaveOrganization}
					class="space-y-4"
					onsubmit={() => {
						saveSubmitting = true;
					}}
				>
					<section class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-4">
						<div>
							<h3 class="text-2xl font-bold font-serif text-neutral-950">Identity</h3>
							<p class="text-sm text-neutral-950 mt-1">
								Update the public organization label and the slug used in URLs and join flows.
							</p>
						</div>

						<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
							<div>
								<label for="organization-name" class="mb-1 block text-sm text-neutral-950">
									Organization name
								</label>
								<input
									id="organization-name"
									name="organizationName"
									type="text"
									class={`input-secondary ${fieldErrors['organizationName'] ? 'border-error-700 focus:border-error-700' : ''}`}
									bind:value={organizationForm.organizationName}
									disabled={!data.canEditOrganization || saveSubmitting}
									autocomplete="organization"
								/>
								{#if fieldErrors['organizationName']}
									<p class="mt-1 text-xs text-error-700">{fieldErrors['organizationName']}</p>
								{/if}
							</div>

							<div>
								<div class="mb-1 flex min-h-6 items-center gap-1.5">
									<label for="organization-slug" class="text-sm leading-6 text-neutral-950">
										Organization slug
									</label>
									<InfoPopover
										buttonAriaLabel="Organization slug help"
										buttonVariant="label-inline"
										align="left"
										panelWidthClass="w-80"
									>
										<div class="space-y-2">
											<p>A slug is the URL-friendly identifier used for public links.</p>
											<p>
												It powers join routes like `{joinPath}` and should stay stable when
												possible.
											</p>
										</div>
									</InfoPopover>
								</div>

								<div class="relative">
									<input
										id="organization-slug"
										name="organizationSlug"
										type="text"
										class={`input-secondary pr-10 ${fieldErrors['organizationSlug'] ? 'border-error-700 focus:border-error-700' : ''}`}
										value={organizationForm.organizationSlug}
										oninput={(event) => {
											organizationForm.organizationSlug = normalizeSlug(
												(event.currentTarget as HTMLInputElement).value
											);
										}}
										disabled={!data.canEditOrganization || saveSubmitting}
										autocomplete="off"
									/>

									<HoverTooltip
										text="Regenerate from organization name"
										wrapperClass="absolute right-2 top-1/2 inline-flex shrink-0 z-10"
									>
										<button
											type="button"
											tabindex="-1"
											class="-translate-y-1/2 inline-flex h-5 w-5 items-center justify-center border-0 bg-transparent text-secondary-700 hover:text-secondary-900 focus:outline-none disabled:cursor-not-allowed disabled:text-secondary-400"
											aria-label="Regenerate slug from organization name"
											onclick={() => {
												organizationForm.organizationSlug = normalizeSlug(
													organizationForm.organizationName
												);
											}}
											disabled={!data.canEditOrganization || saveSubmitting}
										>
											<IconRestore class="h-4 w-4" />
										</button>
									</HoverTooltip>
								</div>

								<p class="mt-1 text-xs text-neutral-950">Current join path: `{joinPath}`</p>
								{#if fieldErrors['organizationSlug']}
									<p class="mt-1 text-xs text-error-700">{fieldErrors['organizationSlug']}</p>
								{/if}
							</div>
						</div>
					</section>

					<section class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-4">
						<div>
							<h3 class="text-2xl font-bold font-serif text-neutral-950">Join Access</h3>
							<p class="text-sm text-neutral-950 mt-1">
								Control whether people can join this organization directly from the public slug.
							</p>
						</div>

						<div class="border border-neutral-950 bg-white p-4 space-y-2">
							<label class="inline-flex items-center gap-2 text-sm text-neutral-950">
								<input
									type="checkbox"
									name="selfJoinEnabled"
									value="1"
									class="toggle-secondary"
									checked={organizationForm.selfJoinEnabled}
									onchange={(event) => {
										organizationForm.selfJoinEnabled = (
											event.currentTarget as HTMLInputElement
										).checked;
									}}
									disabled={!data.canEditOrganization || saveSubmitting}
								/>
								Allow open self-join for `{joinPath}`
							</label>
							<p class="text-xs text-neutral-950">
								When enabled, new members can use the public organization slug to join without an
								invite.
							</p>
						</div>
					</section>

					<section class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-4">
						<div>
							<h3 class="text-2xl font-bold font-serif text-neutral-950">Metadata</h3>
							<p class="text-sm text-neutral-950 mt-1">
								Store optional organization notes or structured JSON that other admin tools can
								reference later.
							</p>
						</div>

						<div>
							<label for="organization-metadata" class="mb-1 block text-sm text-neutral-950">
								Metadata payload
							</label>
							<textarea
								id="organization-metadata"
								name="metadata"
								class={`textarea-secondary min-h-44 ${fieldErrors['metadata'] ? 'border-error-700 focus:border-error-700' : ''}`}
								bind:value={organizationForm.metadata}
								disabled={!data.canEditOrganization || saveSubmitting}
								placeholder={metadataPlaceholder}
							></textarea>
							<div
								class="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-950"
							>
								<span>{metadataCharacterCount}/4000 characters</span>
								<span>
									{#if metadataMode === 'json'}
										JSON detected
									{:else if metadataMode === 'text'}
										Free text
									{:else}
										Optional
									{/if}
								</span>
							</div>
							{#if fieldErrors['metadata']}
								<p class="mt-1 text-xs text-error-700">{fieldErrors['metadata']}</p>
							{/if}
						</div>
					</section>
				</form>

				<aside class="space-y-4">
					<section class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-4">
						<div>
							<h3 class="text-xl font-bold font-serif text-neutral-950">Current Snapshot</h3>
							<p class="text-sm text-neutral-950 mt-1">
								The current organization model tracks identity, join access, membership context, and
								raw metadata.
							</p>
						</div>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
							<div class="border border-neutral-950 bg-white p-3 space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">Role</p>
								<div class="flex items-center gap-2">
									<IconUsersGroup class="h-4 w-4 text-secondary-700" />
									<p class="text-sm font-semibold text-neutral-950">
										{data.membership?.role ?? 'participant'}
									</p>
								</div>
							</div>

							<div class="border border-neutral-950 bg-white p-3 space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">
									Status
								</p>
								<div class="flex items-center gap-2">
									<IconShieldCheck class="h-4 w-4 text-secondary-700" />
									<p class="text-sm font-semibold text-neutral-950">{data.organization.status}</p>
								</div>
							</div>

							<div class="border border-neutral-950 bg-white p-3 space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">
									Default Org
								</p>
								<p class="text-sm font-semibold text-neutral-950">
									{data.membership?.isDefault ? 'Yes' : 'No'}
								</p>
							</div>

							<div class="border border-neutral-950 bg-white p-3 space-y-1">
								<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">
									Join Mode
								</p>
								<div class="flex items-center gap-2">
									<IconWorldWww class="h-4 w-4 text-secondary-700" />
									<p class="text-sm font-semibold text-neutral-950">
										{organizationForm.selfJoinEnabled ? 'Open self-join' : 'Invite or admin only'}
									</p>
								</div>
							</div>
						</div>
					</section>

					<section class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-3">
						<div>
							<h3 class="text-xl font-bold font-serif text-neutral-950">Route Preview</h3>
							<p class="text-sm text-neutral-950 mt-1">
								This is the public path people will use when the organization slug is shared.
							</p>
						</div>

						<div class="border border-neutral-950 bg-white p-3 space-y-2">
							<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">
								Public path
							</p>
							<p class="font-mono text-sm text-neutral-950">{joinPath}</p>
							<p class="text-xs text-neutral-950">
								Self-join is {organizationForm.selfJoinEnabled ? 'enabled' : 'disabled'} for this path.
							</p>
						</div>
					</section>

					<section class="border-2 border-neutral-950 bg-neutral p-4 lg:p-5 space-y-3">
						<div>
							<h3 class="text-xl font-bold font-serif text-neutral-950">Audit Trail</h3>
							<p class="text-sm text-neutral-950 mt-1">
								These are the organization-level timestamps currently stored on the client record.
							</p>
						</div>

						<div class="border border-neutral-950 bg-white p-3 space-y-3 text-sm text-neutral-950">
							<div>
								<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">
									Created
								</p>
								<p>{formatTimestamp(data.organization.createdAt)}</p>
							</div>
							<div>
								<p class="text-[11px] font-bold uppercase tracking-wide text-secondary-700">
									Last updated
								</p>
								<p>{formatTimestamp(data.organization.updatedAt)}</p>
							</div>
						</div>
					</section>
				</aside>
			</div>
		</section>
	{/if}
</div>
