<script lang="ts">
	let { data, form } = $props<{
		data: {
			next: string;
		};
		form?: {
			error?: string;
			email?: string;
			next?: string;
		};
	}>();
</script>

<svelte:head>
	<title>Login | PlayIMs</title>
</svelte:head>

<div class="min-h-screen bg-secondary-500 flex items-center justify-center px-4">
	<div class="w-full max-w-md bg-white border border-neutral-200 p-6">
		<h1 class="text-2xl font-bold text-primary-950 mb-2">Sign in</h1>
		<p class="text-sm text-secondary-900 mb-6">Use your PlayIMs account to continue.</p>

		{#if form?.error}
			<p class="mb-4 text-sm text-red-700 bg-red-100 border border-red-200 p-2">{form.error}</p>
		{/if}

		<form method="POST" class="space-y-4">
			<!-- Preserve safe post-login destination from server-side validation. -->
			<input type="hidden" name="next" autocomplete="off" value={form?.next ?? data.next} />

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Email</span>
				<input
					class="input-secondary w-full"
					type="email"
					name="email"
					autocomplete="off"
					value={form?.email ?? ''}
					required
				/>
			</label>

			<label class="block">
				<span class="block text-sm font-medium text-secondary-900 mb-1">Password</span>
				<input
					class="input-secondary w-full"
					type="password"
					name="password"
					autocomplete="off"
					required
				/>
			</label>

			<button class="button-secondary w-full" type="submit">Sign in</button>
		</form>

		<p class="mt-4 text-sm text-secondary-900">
			Need an account?
			<a class="text-primary-700 hover:underline" href="/auth/register">Register</a>
		</p>
	</div>
</div>
