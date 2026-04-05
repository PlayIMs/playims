export interface CommunicationEditorSpecialCharacter {
	value: string;
	label: string;
	category: 'typography' | 'currency' | 'math' | 'arrows' | 'fractions' | 'misc';
	searchText: string;
}

export const communicationEditorSpecialCharacters: CommunicationEditorSpecialCharacter[] = [
	{ value: '—', label: 'Em Dash', category: 'typography', searchText: 'em dash long dash' },
	{ value: '–', label: 'En Dash', category: 'typography', searchText: 'en dash range dash' },
	{ value: '…', label: 'Ellipsis', category: 'typography', searchText: 'ellipsis dots' },
	{ value: '•', label: 'Bullet Point', category: 'typography', searchText: 'bullet point dot list' },
	{ value: '†', label: 'Dagger', category: 'typography', searchText: 'dagger footnote' },
	{ value: '‡', label: 'Double Dagger', category: 'typography', searchText: 'double dagger footnote' },
	{ value: '¶', label: 'Pilcrow (Paragraph)', category: 'typography', searchText: 'pilcrow paragraph paragraph mark' },
	{ value: '§', label: 'Section Sign', category: 'typography', searchText: 'section sign section legal' },
	{ value: '©', label: 'Copyright', category: 'typography', searchText: 'copyright legal' },
	{ value: '®', label: 'Registered Trademark', category: 'typography', searchText: 'registered trademark legal' },
	{ value: '™', label: 'Trademark', category: 'typography', searchText: 'trademark legal' },
	{ value: '€', label: 'Euro Sign', category: 'currency', searchText: 'euro sign currency money' },
	{ value: '£', label: 'British Pound', category: 'currency', searchText: 'british pound pound sterling currency money' },
	{ value: '¥', label: 'Japanese Yen', category: 'currency', searchText: 'japanese yen yen currency money' },
	{ value: '¢', label: 'Cent Sign', category: 'currency', searchText: 'cent sign currency money' },
	{ value: '½', label: 'One-Half', category: 'fractions', searchText: 'one half one-half fraction' },
	{ value: '⅓', label: 'One-Third', category: 'fractions', searchText: 'one third one-third fraction' },
	{ value: '¼', label: 'One-Fourth', category: 'fractions', searchText: 'one fourth one-fourth quarter fraction' },
	{ value: '¾', label: 'Three-Fourths', category: 'fractions', searchText: 'three fourths three-fourths fraction' },
	{ value: '°', label: 'Degree Symbol', category: 'typography', searchText: 'degree symbol temperature angle' },
	{ value: '✓', label: 'Check Mark', category: 'misc', searchText: 'check mark check tick' },
	{ value: 'ñ', label: 'Tilde (n)', category: 'typography', searchText: 'tilde n enye' },
	{ value: 'ü', label: 'Umlaut (u)', category: 'typography', searchText: 'umlaut u umlauted u' },
	{ value: 'ç', label: 'Cedilla (c)', category: 'typography', searchText: 'cedilla c cedilla c' },
	{ value: 'à', label: 'Grave Accent (a)', category: 'typography', searchText: 'grave accent a' },
	{ value: 'é', label: 'Acute Accent (e)', category: 'typography', searchText: 'acute accent e' },
	{ value: '±', label: 'Plus-Minus', category: 'math', searchText: 'plus minus math' },
	{ value: '×', label: 'Multiplication Sign', category: 'math', searchText: 'multiplication sign multiply times math' },
	{ value: '÷', label: 'Division Sign', category: 'math', searchText: 'division sign divide division math' },
	{ value: '≠', label: 'Not Equal To', category: 'math', searchText: 'not equal to not equal math comparison' },
	{ value: '≈', label: 'Almost Equal To', category: 'math', searchText: 'almost equal to approximately math comparison' },
	{ value: '≤', label: 'Less-Than or Equal To', category: 'math', searchText: 'less than or equal to math comparison' },
	{ value: '≥', label: 'Greater-Than or Equal To', category: 'math', searchText: 'greater than or equal to math comparison' },
	{ value: '∞', label: 'Infinity', category: 'math', searchText: 'infinity math' },
	{ value: 'π', label: 'Pi', category: 'math', searchText: 'pi math' },
	{ value: '√', label: 'Square Root', category: 'math', searchText: 'square root radical math' },
	{ value: '∑', label: 'N-Ary Summation', category: 'math', searchText: 'summation n-ary summation sigma math' },
	{ value: '→', label: 'Right Arrow', category: 'arrows', searchText: 'right arrow direction' },
	{ value: '←', label: 'Left Arrow', category: 'arrows', searchText: 'left arrow direction' },
	{ value: '↑', label: 'Up Arrow', category: 'arrows', searchText: 'up arrow direction' },
	{ value: '↓', label: 'Down Arrow', category: 'arrows', searchText: 'down arrow direction' },
	{ value: '«', label: 'Left Angle Quote', category: 'typography', searchText: 'left angle quote guillemet' },
	{ value: '»', label: 'Right Angle Quote', category: 'typography', searchText: 'right angle quote guillemet' },
	{ value: '‰', label: 'Per Mille', category: 'typography', searchText: 'per mille rate percent thousand' }
];

export function getCommunicationEditorSpecialCharacter(value: string) {
	return communicationEditorSpecialCharacters.find((option) => option.value === value) ?? null;
}
