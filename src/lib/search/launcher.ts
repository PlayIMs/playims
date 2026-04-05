export function isSearchPaletteLauncherActivationKey(key: string): boolean {
	return key === 'Enter' || key === ' ' || key === 'Spacebar';
}
