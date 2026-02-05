<script lang="ts">
	import { format, addDays, startOfWeek } from 'date-fns';

	// Sample schedule data - this will come from the database
	const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
	
	const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

	// Placeholder events - replace with real data from events table
	const events = [
		{
			id: '1',
			title: 'Winter Basketball - Game 1',
			date: new Date(),
			time: '6:00 PM',
			location: 'Campus Rec Center - Court A',
			status: 'scheduled'
		},
		{
			id: '2',
			title: 'Indoor Soccer - Semi Final',
			date: addDays(new Date(), 1),
			time: '7:30 PM',
			location: 'Indoor Sports Arena - Field 1',
			status: 'scheduled'
		}
	];
</script>

<svelte:head>
	<title>Schedule | PlayIMs</title>
	<meta name="description" content="View and manage your league schedule" />
</svelte:head>

<div class="p-6">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-primary-950 mb-2">Schedule</h1>
		<p class="text-neutral-700">View and manage games, events, and facility bookings</p>
	</div>

	<!-- Week View -->
	<div class="bg-white border-2 border-neutral-300">
		<!-- Week Header -->
		<div class="grid grid-cols-7 border-b-2 border-neutral-300">
			{#each weekDays as day}
				<div class="p-4 text-center border-r-2 border-neutral-300 last:border-r-0">
					<div class="text-sm text-neutral-500 uppercase">{format(day, 'EEE')}</div>
					<div class="text-xl font-bold text-primary-950">{format(day, 'd')}</div>
				</div>
			{/each}
		</div>

		<!-- Week Grid -->
		<div class="grid grid-cols-7 min-h-96">
			{#each weekDays as day}
				<div class="border-r-2 border-neutral-300 last:border-r-0 p-2 min-h-32">
					{#each events.filter(e => format(e.date, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')) as event}
						<div class="bg-primary text-white p-2 mb-2 text-sm">
							<div class="font-semibold">{event.time}</div>
							<div class="truncate">{event.title}</div>
							<div class="text-xs text-primary-100 truncate">{event.location}</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- Upcoming Events List -->
	<div class="mt-6">
		<h2 class="text-xl font-bold text-primary-950 mb-4">Upcoming Events</h2>
		<div class="bg-white border-2 border-neutral-300">
			{#each events as event}
				<div class="p-4 border-b-2 border-neutral-300 last:border-b-0 flex items-center justify-between hover:bg-neutral-50">
					<div class="flex items-center gap-4">
						<div class="bg-primary text-white p-3 text-center min-w-16">
							<div class="text-sm uppercase">{format(event.date, 'MMM')}</div>
							<div class="text-2xl font-bold">{format(event.date, 'd')}</div>
						</div>
						<div>
							<h3 class="font-bold text-primary-950">{event.title}</h3>
							<p class="text-neutral-700 text-sm">{event.time} • {event.location}</p>
						</div>
					</div>
					<span class="px-3 py-1 bg-secondary text-secondary-950 text-sm font-medium">
						{event.status}
					</span>
				</div>
			{/each}
		</div>
	</div>
</div>
