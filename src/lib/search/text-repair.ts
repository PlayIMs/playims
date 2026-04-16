const LIKELY_MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
	['\u00e2\u20ac\u00a2', '\u2022'],
	['\u00e2\u20ac\u201c', '\u2013'],
	['\u00e2\u20ac\u201d', '\u2014'],
	['\u00e2\u20ac\u02dc', '\u2018'],
	['\u00e2\u20ac\u2122', '\u2019'],
	['\u00e2\u20ac\u0153', '\u201c'],
	['\u00e2\u20ac\u009d', '\u201d'],
	['\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2', '\u2022'],
	['\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u0153', '\u2013'],
	['\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d', '\u2014']
];

export function repairLikelyMojibake(value: string | null | undefined): string | null {
	if (!value) return value ?? null;

	let repaired = value;
	for (const [broken, fixed] of LIKELY_MOJIBAKE_REPLACEMENTS) {
		repaired = repaired.split(broken).join(fixed);
	}

	return repaired;
}
