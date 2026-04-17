export interface DashboardSeasonActionOption {
	value: 'manage-seasons' | 'create-season';
	label: string;
}

export function buildDashboardSeasonActionOptions(input: {
	hasSeasonHistory: boolean;
}): DashboardSeasonActionOption[] {
	const options: DashboardSeasonActionOption[] = [];

	if (input.hasSeasonHistory) {
		options.push({
			value: 'manage-seasons',
			label: 'Manage Seasons'
		});
	}

	options.push({
		value: 'create-season',
		label: 'Create Season'
	});

	return options;
}
