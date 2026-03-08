<svelte:head>
	<title>Developer Tools | PlayIMs</title>
</svelte:head>

<script lang="ts">
	import {
		IconCode,
		IconPalette,
		IconBellRinging,
		IconTool,
		IconDatabase,
		IconRocket
	} from '@tabler/icons-svelte';

	type ToolCard = {
		title: string;
		description: string;
		href?: string;
		status: 'available' | 'placeholder';
		icon: typeof IconCode;
	};

	const toolCards: ToolCard[] = [
		{
			title: 'Color Theme Lab',
			description: 'Open the theme and color editor page used to inspect generated palettes and tokens.',
			href: '/colors',
			status: 'available',
			icon: IconPalette
		},
		{
			title: 'Toast Lab',
			description: 'Test variants, queueing, stack stress, mobile placement, actions, and timing behavior.',
			href: '/dashboard/dev/toasts',
			status: 'available',
			icon: IconBellRinging
		},
		{
			title: 'Component Sandbox',
			description: 'Reserved for future shared-component playgrounds and isolated UI experiments.',
			status: 'placeholder',
			icon: IconTool
		},
		{
			title: 'Fixture Browser',
			description: 'Reserved for inspecting seeded data, test fixtures, and mock response tooling.',
			status: 'placeholder',
			icon: IconDatabase
		},
		{
			title: 'Release Checks',
			description: 'Reserved for pre-release smoke tests, QA shortcuts, and developer-only checklists.',
			status: 'placeholder',
			icon: IconRocket
		}
	];
</script>

<div class="space-y-6 p-4">
	<section class="border-2 border-neutral-950 bg-neutral">
		<div class="border-b border-neutral-950 bg-neutral-600/66 p-4">
			<div class="flex items-start gap-3">
				<div
					class="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-secondary-300 bg-secondary text-white"
				>
					<IconCode class="h-6 w-6" />
				</div>
				<div class="space-y-2">
					<p class="text-xs font-bold uppercase tracking-[0.16em] text-secondary-700">
						Developer Only
					</p>
					<h1 class="font-serif text-3xl leading-none text-secondary-900">Developer Tools</h1>
					<p class="max-w-3xl text-sm leading-6 text-secondary-800">
						Open internal labs, visual sandboxes, and future debugging tools without typing routes by
						hand. These pages are intentionally restricted to the developer role.
					</p>
				</div>
			</div>
		</div>

		<div class="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
			{#each toolCards as card}
				{#if card.href}
					<a
						href={card.href}
						class="group border border-neutral-950 bg-white p-4 transition-colors duration-150 hover:bg-secondary-50"
					>
						<div class="flex items-start gap-3">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center border border-secondary-300 bg-secondary text-white"
							>
								<card.icon class="h-5 w-5" />
							</div>
							<div class="space-y-2">
								<div class="flex items-center gap-2">
									<h2 class="font-serif text-xl text-secondary-900">{card.title}</h2>
									<span
										class="border border-success-500 bg-success-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-success-900"
									>
										Available
									</span>
								</div>
								<p class="text-sm leading-6 text-secondary-800">{card.description}</p>
								<p class="text-xs font-bold uppercase tracking-[0.14em] text-secondary-700">
									Open tool
								</p>
							</div>
						</div>
					</a>
				{:else}
					<div class="border border-dashed border-neutral-950 bg-neutral-100/70 p-4">
						<div class="flex items-start gap-3">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center border border-neutral-950 bg-white text-secondary-800"
							>
								<card.icon class="h-5 w-5" />
							</div>
							<div class="space-y-2">
								<div class="flex items-center gap-2">
									<h2 class="font-serif text-xl text-secondary-900">{card.title}</h2>
									<span
										class="border border-secondary-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-secondary-700"
									>
										Placeholder
									</span>
								</div>
								<p class="text-sm leading-6 text-secondary-800">{card.description}</p>
							</div>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</section>
</div>

