<script lang="ts">
	import { page } from '$app/stores';
	import IconBell from '@tabler/icons-svelte/icons/bell';
	import IconBuilding from '@tabler/icons-svelte/icons/building';
	import IconCreditCard from '@tabler/icons-svelte/icons/credit-card';
	import IconPalette from '@tabler/icons-svelte/icons/palette';
	import IconPuzzle from '@tabler/icons-svelte/icons/puzzle';
	import IconUserCheck from '@tabler/icons-svelte/icons/user-check';

	let { children, data } = $props();

	const settingsTitle = $derived.by(() => data?.navigationLabels?.settings ?? 'Settings');

	const tabs = [
		{
			key: 'modules',
			label: 'Modules',
			href: '/dashboard/settings/modules',
			icon: IconPuzzle,
			description: 'Rename and reorder sidebar tabs.'
		},
		{
			key: 'organization',
			label: 'Organization',
			href: '/dashboard/settings/organization',
			icon: IconBuilding,
			description: 'Core organization configuration.'
		},
		{
			key: 'registrations',
			label: 'Registrations',
			href: '/dashboard/settings/registrations',
			icon: IconUserCheck,
			description: 'Player and team registration rules.'
		},
		{
			key: 'notifications',
			label: 'Notifications',
			href: '/dashboard/settings/notifications',
			icon: IconBell,
			description: 'Delivery and messaging preferences.'
		},
		{
			key: 'branding',
			label: 'Branding',
			href: '/dashboard/settings/branding',
			icon: IconPalette,
			description: 'Theme and visual identity settings.'
		},
		{
			key: 'billing',
			label: 'Billing',
			href: '/dashboard/settings/billing',
			icon: IconCreditCard,
			description: 'Plans, invoices, and payment controls.'
		}
	] as const;

	const activePath = $derived.by(() => $page.url.pathname);
	const isActive = (href: string): boolean =>
		activePath === href || activePath.startsWith(`${href}/`);
</script>

<svelte:head>
	<title>{settingsTitle} - PlayIMs</title>
	<meta name="description" content="Organization settings and configuration center." />
</svelte:head>

<div class="w-full p-4 lg:p-6 space-y-5">
	<header class="border-2 border-secondary-300 bg-neutral p-4 lg:p-5">
		<h1 class="text-4xl lg:text-5xl leading-[0.9] font-bold font-serif text-neutral-950">
			{settingsTitle}
		</h1>
		<p class="mt-2 text-sm text-neutral-950">
			Manage organization-level controls from one workspace.
		</p>
	</header>

	<div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[17rem_1fr]">
		<aside class="self-start border-2 border-secondary-300 bg-neutral p-3 lg:sticky lg:top-4">
			<nav aria-label="Settings sections">
				<ul class="space-y-2">
					{#each tabs as tab}
						<li>
							<a
								href={tab.href}
								class={`flex w-full items-start gap-2 border-2 px-3 py-2.5 transition-colors ${
									isActive(tab.href)
										? 'border-primary-600 bg-primary text-white'
										: 'border-secondary-300 bg-white text-neutral-950 hover:bg-neutral-200'
								}`}
								aria-current={isActive(tab.href) ? 'page' : undefined}
							>
								<tab.icon class="mt-0.5 h-4 w-4 shrink-0" />
								<span class="min-w-0">
									<span class="block text-sm font-semibold">{tab.label}</span>
									<span
										class={`block text-[11px] leading-tight ${
											isActive(tab.href) ? 'text-white/90' : 'text-neutral-950'
										}`}
									>
										{tab.description}
									</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>

		<section class="min-w-0">
			{@render children()}
		</section>
	</div>
</div>
