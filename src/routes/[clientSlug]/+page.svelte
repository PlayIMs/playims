<script lang="ts">
	let { data } = $props();

	let isSubmitting = $state(false);
	let actionError = $state('');

	const isCurrentClient = $derived(data.auth.activeClientId === data.client.id);
	const isActiveMember = $derived(data.auth.membershipState === 'active');
	const isInactiveMember = $derived(data.auth.membershipState === 'inactive');
	const canSelfJoin = $derived(
		data.auth.isAuthenticated &&
			!isActiveMember &&
			!isInactiveMember &&
			data.client.selfJoinEnabled
	);

	const submitClientAction = async (endpoint: string, body: Record<string, unknown>) => {
		isSubmitting = true;
		actionError = '';

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			let payload: { error?: string } | null = null;
			try {
				payload = (await response.json()) as { error?: string };
			} catch {
				payload = null;
			}

			if (!response.ok) {
				actionError = payload?.error ?? 'Unable to complete your request right now.';
				return;
			}

			window.location.href = '/dashboard';
		} catch {
			actionError = 'Unable to complete your request right now.';
		} finally {
			isSubmitting = false;
		}
	};

	const handleJoin = async () => {
		await submitClientAction('/api/auth/join-client', { clientSlug: data.client.slug });
	};

	const handleSwitch = async () => {
		await submitClientAction('/api/auth/switch-client', { clientId: data.client.id });
	};
</script>

<svelte:head>
	<title>{data.client.name} | PlayIMs</title>
</svelte:head>

<div class="min-h-screen bg-neutral-500">
	<div class="max-w-3xl mx-auto px-6 py-16">
		<div class="bg-white border border-primary-700 p-8 space-y-6">
			<p class="text-xs font-semibold tracking-widest text-secondary-700 uppercase">
				Organization Access
			</p>
			<h1 class="text-4xl font-bold text-primary-950">{data.client.name}</h1>
			<p class="text-secondary-900">Join this organization to access its PlayIMs workspace.</p>

			{#if actionError}
				<div class="border border-red-700 bg-red-50 text-red-900 px-4 py-3" role="alert">
					{actionError}
				</div>
			{/if}

			{#if !data.auth.isAuthenticated}
				<div class="space-y-3">
					<p class="text-secondary-900">Sign in or create an account first, then join manually.</p>
					<div class="flex flex-wrap gap-3">
						<a class="button-primary-outlined px-6" href={data.loginPath}>Log in</a>
						<a class="button-secondary-outlined px-6" href={data.registerPath}>Register</a>
					</div>
				</div>
			{:else if isActiveMember}
				<div class="space-y-3">
					<p class="text-secondary-900">
						You are already a member of this organization
						{#if data.auth.membershipRole}
							(<span class="font-semibold">{data.auth.membershipRole}</span>)
						{/if}.
					</p>
					{#if isCurrentClient}
						<p class="text-secondary-900">This organization is already your active workspace.</p>
						<a class="button-primary-outlined px-6" href="/dashboard">Go to dashboard</a>
					{:else}
						<button
							type="button"
							class="button-primary-outlined px-6"
							onclick={handleSwitch}
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Switching...' : 'Switch to this organization'}
						</button>
					{/if}
				</div>
			{:else if isInactiveMember}
				<div class="space-y-3">
					<p class="text-secondary-900">
						Your membership for this organization is inactive. Contact an administrator to reactivate
						access.
					</p>
				</div>
			{:else if canSelfJoin}
				<div class="space-y-3">
					<p class="text-secondary-900">You can join this organization now.</p>
					<button
						type="button"
						class="button-primary-outlined px-6"
						onclick={handleJoin}
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Joining...' : 'Join organization'}
					</button>
				</div>
			{:else}
				<div class="space-y-3">
					<p class="text-secondary-900">
						This organization does not allow open self-join. Contact an organization administrator for
						access.
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
