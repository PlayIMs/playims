export type OfferingWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export function shouldShowOfferingLinkStep(
	candidateCount: number,
	linkedOfferingId: string
): boolean {
	return candidateCount > 0 || linkedOfferingId.trim().length > 0;
}

export function getCreateOfferingVisibleSteps(
	showOfferingLinkStep: boolean
): OfferingWizardStep[] {
	return showOfferingLinkStep ? [1, 2, 3, 4, 5, 6] : [1, 3, 4, 5, 6];
}
