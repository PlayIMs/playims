import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const gitBin = 'git';
const childMaxBuffer = 50 * 1024 * 1024;
const envFilePath = resolve('.env');
const minNodeMajor = 20;
const recommendedNodeMajor = 24;
const corepackExecutable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const corepackPath = resolve(dirname(process.execPath), corepackExecutable);
const pnpmBin = existsSync(corepackPath) ? `"${corepackPath}" pnpm` : 'pnpm';
const placeholderCloudflareValues = new Set([
	'cloudflare_account_id',
	'd1_database_id',
	'cloudflare_api_token'
]);

function formatTimestampForFile(date) {
	const pad = (value) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

const logDir = resolve('logs/catch-up');
mkdirSync(logDir, { recursive: true });
const logFilePath = resolve(logDir, `catch-up-${formatTimestampForFile(new Date())}.log`);

function appendLog(chunk, encoding) {
	if (chunk === undefined || chunk === null) {
		return;
	}

	const normalizedEncoding = typeof encoding === 'string' ? encoding : 'utf8';
	const rawText = Buffer.isBuffer(chunk)
		? chunk.toString(normalizedEncoding)
		: String(chunk);
	const plainText = stripVTControlCharacters(rawText);
	appendFileSync(logFilePath, plainText, { encoding: 'utf8' });
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = function patchedStdoutWrite(chunk, encoding, callback) {
	appendLog(chunk, encoding);
	return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = function patchedStderrWrite(chunk, encoding, callback) {
	appendLog(chunk, encoding);
	return originalStderrWrite(chunk, encoding, callback);
};

const summary = {
	errors: [],
	warnings: [],
	actions: [],
	localProcessedMigrations: []
};
const checkTimeline = [];
const toolingVersions = [];

const ansi = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m'
};
const useAnsi = !('NO_COLOR' in process.env);
const packageJson = readPackageJson();

function colorize(text, ...codes) {
	if (!useAnsi || codes.length === 0) {
		return text;
	}
	return `${codes.join('')}${text}${ansi.reset}`;
}

function statusVisual(status) {
	if (status === 'pass') {
		return colorize('PASS', ansi.bold, ansi.green);
	}
	if (status === 'fail') {
		return colorize('FAIL', ansi.bold, ansi.red);
	}
	return colorize('WARN', ansi.bold, ansi.yellow);
}

function checkIcon(status) {
	if (status === 'pass') {
		return colorize('+', ansi.green);
	}
	if (status === 'fail') {
		return colorize('x', ansi.red);
	}
	return colorize('!', ansi.yellow);
}

function readPackageJson() {
	const packageJsonPath = resolve('package.json');
	if (!existsSync(packageJsonPath)) {
		return null;
	}

	try {
		return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	} catch {
		return null;
	}
}

function section(title) {
	console.log(`\n${colorize(`=== ${title} ===`, ansi.bold, ansi.cyan)}`);
}

function pushAction(action) {
	if (!action || summary.actions.includes(action)) {
		return;
	}
	summary.actions.push(action);
}

function addWarning(message, action) {
	summary.warnings.push(message);
	pushAction(action);
}

function addError(message, action) {
	summary.errors.push(message);
	pushAction(action);
}

function startCheck(name) {
	const entry = {
		name,
		status: 'pass',
		details: []
	};
	checkTimeline.push(entry);
	return {
		entry,
		errorStart: summary.errors.length,
		warningStart: summary.warnings.length
	};
}

function finishCheck(context, options = {}) {
	const { ok = true, note = '' } = options;
	const newErrors = summary.errors.slice(context.errorStart);
	const newWarnings = summary.warnings.slice(context.warningStart);

	if (note) {
		context.entry.details.push(note);
	}

	for (const message of newErrors) {
		context.entry.details.push(`error: ${message}`);
	}

	for (const message of newWarnings) {
		context.entry.details.push(`warning: ${message}`);
	}

	if (!ok || newErrors.length > 0) {
		context.entry.status = 'fail';
		return;
	}

	if (newWarnings.length > 0) {
		context.entry.status = 'warn';
		return;
	}

	context.entry.status = 'pass';
}

function recordToolingVersion(entry) {
	const existingIndex = toolingVersions.findIndex((item) => item.name === entry.name);
	if (existingIndex >= 0) {
		toolingVersions[existingIndex] = entry;
		return;
	}
	toolingVersions.push(entry);
}

function runCommand(label, command, args, options = {}) {
	const { env = process.env } = options;
	const commandLine = [command, ...args].join(' ');
	console.log(`\n${colorize('[run]', ansi.bold, ansi.cyan)} ${label}`);
	console.log(colorize(`$ ${commandLine}`, ansi.gray));
	const result = spawnSync(commandLine, {
		encoding: 'utf8',
		shell: true,
		maxBuffer: childMaxBuffer,
		env
	});
	if (result.stdout) {
		process.stdout.write(result.stdout);
	}
	if (result.stderr) {
		process.stderr.write(result.stderr);
	}
	return !result.error && result.status === 0;
}

function runCommandCapture(command, args, options = {}) {
	const { env = process.env } = options;
	const commandLine = [command, ...args].join(' ');
	const result = spawnSync(commandLine, {
		encoding: 'utf8',
		shell: true,
		maxBuffer: childMaxBuffer,
		env
	});
	return {
		ok: !result.error && result.status === 0,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
		status: result.status,
		error: result.error
	};
}

function extractJsonPayload(stdout) {
	if (!stdout) {
		return null;
	}

	const startIndex = stdout.indexOf('[');
	if (startIndex === -1) {
		return null;
	}

	const jsonText = stdout.slice(startIndex).trim();
	try {
		return JSON.parse(jsonText);
	} catch {
		return null;
	}
}

function parseEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return null;
	}

	const content = readFileSync(filePath, 'utf8');
	const map = new Map();
	const linePattern = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const match = rawLine.match(linePattern);
		if (!match) {
			continue;
		}

		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		map.set(match[1], value);
	}

	return map;
}

function readEnvValue(key) {
	const fromProcess = process.env[key];
	if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
		return fromProcess.trim();
	}

	const parsedEnv = parseEnvFile(envFilePath);
	const fromFile = parsedEnv?.get(key)?.trim();
	if (fromFile && fromFile.length > 0) {
		return fromFile;
	}

	return '';
}

function parseMajorVersion(version) {
	const match = version.trim().match(/^v?(\d+)/);
	return match ? Number(match[1]) : Number.NaN;
}

function readPackageManagerRequirement() {
	const fallback = {
		name: 'pnpm',
		version: '',
		major: Number.NaN
	};
	if (!packageJson) {
		return fallback;
	}

	try {
		if (typeof packageJson.packageManager !== 'string') {
			return fallback;
		}

		const [name, version = ''] = packageJson.packageManager.split('@');
		return {
			name: name || 'pnpm',
			version,
			major: parseMajorVersion(version || '')
		};
	} catch {
		return fallback;
	}
}

function readDevDependencyVersion(packageName) {
	if (!packageJson?.devDependencies || typeof packageJson.devDependencies !== 'object') {
		return '';
	}

	const version = packageJson.devDependencies[packageName];
	return typeof version === 'string' ? version : '';
}

function sanitizeCloudflareValue(rawValue) {
	const normalized = rawValue.trim();
	if (!normalized) {
		return '';
	}

	if (placeholderCloudflareValues.has(normalized.toLowerCase())) {
		return '';
	}

	return normalized;
}

function getCloudflareAuthContext() {
	const accountId = sanitizeCloudflareValue(readEnvValue('CLOUDFLARE_ACCOUNT_ID'));
	const databaseId = sanitizeCloudflareValue(readEnvValue('CLOUDFLARE_DATABASE_ID'));
	const apiToken = sanitizeCloudflareValue(readEnvValue('CLOUDFLARE_API_TOKEN'));
	const tokenFromProcess =
		typeof process.env.CLOUDFLARE_API_TOKEN === 'string' &&
		process.env.CLOUDFLARE_API_TOKEN.trim().length > 0;

	return {
		accountId,
		databaseId,
		apiToken,
		hasApiToken: Boolean(apiToken),
		tokenSource: tokenFromProcess ? 'process.env' : '.env'
	};
}

function buildCloudflareEnv(authContext) {
	const env = { ...process.env };
	if (authContext.accountId) {
		env.CLOUDFLARE_ACCOUNT_ID = authContext.accountId;
	}
	if (authContext.databaseId) {
		env.CLOUDFLARE_DATABASE_ID = authContext.databaseId;
	}
	if (authContext.apiToken) {
		env.CLOUDFLARE_API_TOKEN = authContext.apiToken;
	}
	return env;
}

function readAuthEnvKeys() {
	const fallback = ['AUTH_SESSION_SECRET', 'AUTH_SIGNUP_INVITE_KEY', 'AUTH_PASSWORD_PBKDF2_ITERATIONS'];
	const constantsPath = resolve('src/lib/server/auth/constants.ts');
	if (!existsSync(constantsPath)) {
		return fallback;
	}

	const content = readFileSync(constantsPath, 'utf8');
	const match = content.match(/AUTH_ENV_KEYS\s*=\s*{([\s\S]*?)}\s*as const/);
	if (!match) {
		return fallback;
	}

	const keys = [...match[1].matchAll(/:\s*'([A-Z0-9_]+)'/g)].map((capture) => capture[1]);
	return keys.length > 0 ? keys : fallback;
}

function validateEnvFile(filePath, requiredKeys, options = {}) {
	const { label = filePath, placeholderMap = null } = options;
	const parsed = parseEnvFile(filePath);

	if (!parsed) {
		addError(`${label} is missing.`, `Create ${label} and add: ${requiredKeys.join(', ')}`);
		return;
	}

	const missing = requiredKeys.filter((key) => {
		const value = parsed.get(key);
		return value === undefined || value.trim().length === 0;
	});

	if (missing.length > 0) {
		addError(`${label} is missing required variables: ${missing.join(', ')}`);
	}

	if (placeholderMap) {
		for (const [key, expectedPlaceholder] of placeholderMap.entries()) {
			if (!parsed.has(key)) {
				continue;
			}

			const currentValue = parsed.get(key)?.trim();
			if (!currentValue || !expectedPlaceholder) {
				continue;
			}

			if (currentValue === expectedPlaceholder) {
				addWarning(`${label} key "${key}" still matches the placeholder value from .env.example.`);
			}
		}
	}
}

function checkNodeVersion() {
	const installed = process.version;
	const major = Number(process.versions.node.split('.')[0]);
	if (Number.isNaN(major) || major < minNodeMajor) {
		recordToolingVersion({
			name: 'Node.js',
			installed,
			required: `>=${minNodeMajor}`,
			recommended: `>=${recommendedNodeMajor}`,
			status: 'fail'
		});
		addError(
			`Node.js ${installed} detected. This project requires Node ${minNodeMajor}+ and recommends ${recommendedNodeMajor}+.`,
			'Install Node.js v24 LTS for consistent local tooling behavior.'
		);
		return false;
	}

	if (major < recommendedNodeMajor) {
		recordToolingVersion({
			name: 'Node.js',
			installed,
			required: `>=${minNodeMajor}`,
			recommended: `>=${recommendedNodeMajor}`,
			status: 'warn'
		});
		addWarning(
			`Node.js ${installed} detected. Node ${recommendedNodeMajor}+ is recommended for this project.`,
			'Upgrade to Node.js v24 when possible.'
		);
		return true;
	}

	recordToolingVersion({
		name: 'Node.js',
		installed,
		required: `>=${minNodeMajor}`,
		recommended: `>=${recommendedNodeMajor}`,
		status: 'pass'
	});
	return true;
}

function checkPnpmVersion(installedVersion) {
	const requirement = readPackageManagerRequirement();
	const requiredText = !Number.isNaN(requirement.major)
		? `major ${requirement.major}.x`
		: 'from packageManager';
	const recommendedText = requirement.version || requiredText;

	if (requirement.name !== 'pnpm') {
		recordToolingVersion({
			name: 'pnpm',
			installed: installedVersion || 'not found',
			required: `packageManager=${requirement.name}`,
			recommended: 'pnpm',
			status: 'warn'
		});
		addWarning(
			`packageManager is set to "${requirement.name}". Catch-up expects pnpm.`,
			'Update packageManager in package.json or adjust catch-up script expectations.'
		);
		return true;
	}

	const installedMajor = parseMajorVersion(installedVersion);
	if (!Number.isNaN(requirement.major) && !Number.isNaN(installedMajor) && installedMajor !== requirement.major) {
		recordToolingVersion({
			name: 'pnpm',
			installed: installedVersion,
			required: requiredText,
			recommended: recommendedText,
			status: 'fail'
		});
		addError(
			`pnpm ${installedVersion} detected, but project packageManager expects pnpm@${requirement.version}.`,
			`Use pnpm ${requirement.version} (or pnpm ${requirement.major}.x) for consistent lockfile behavior.`
		);
		return false;
	}

	if (requirement.version && installedVersion !== requirement.version) {
		recordToolingVersion({
			name: 'pnpm',
			installed: installedVersion,
			required: requiredText,
			recommended: recommendedText,
			status: 'warn'
		});
		addWarning(
			`pnpm ${installedVersion} detected. Project pins pnpm@${requirement.version}.`,
			`Switch to pnpm ${requirement.version} for fully reproducible dependency resolution.`
		);
		return true;
	}

	recordToolingVersion({
		name: 'pnpm',
		installed: installedVersion,
		required: requiredText,
		recommended: recommendedText,
		status: 'pass'
	});
	return true;
}

function runPnpmVersionCheck() {
	const requirement = readPackageManagerRequirement();
	const requiredText = !Number.isNaN(requirement.major)
		? `major ${requirement.major}.x`
		: 'from packageManager';
	const recommendedText = requirement.version || requiredText;

	const pnpmVersion = runCommandCapture(pnpmBin, ['--version']);
	if (!pnpmVersion.ok) {
		recordToolingVersion({
			name: 'pnpm',
			installed: 'not found',
			required: requiredText,
			recommended: recommendedText,
			status: 'fail'
		});
		addError('Unable to run pnpm. Install pnpm 10.x and retry.', 'Install pnpm globally: npm i -g pnpm');
		return {
			ok: false,
			version: ''
		};
	}

	const installedPnpmVersion = pnpmVersion.stdout.trim();
	console.log(`[info] pnpm ${installedPnpmVersion}`);
	const versionOk = checkPnpmVersion(installedPnpmVersion);
	return {
		ok: versionOk,
		version: installedPnpmVersion
	};
}

function runGitSync() {
	section('Git Sync');

	const repoCheck = runCommandCapture(gitBin, ['rev-parse', '--is-inside-work-tree']);
	if (!repoCheck.ok || repoCheck.stdout.trim() !== 'true') {
		addWarning('Git repository check failed. Skipping pull/fetch steps.');
		return;
	}

	const statusCheck = runCommandCapture(gitBin, ['status', '--porcelain']);
	const hasLocalChanges = statusCheck.ok && statusCheck.stdout.trim().length > 0;
	if (hasLocalChanges) {
		addWarning(
			'Uncommitted git changes detected. Automatic pull is skipped to avoid merge conflicts.',
			'Commit or stash local changes, then run: git pull --ff-only'
		);
	}

	const fetched = runCommand('Fetch remote refs', gitBin, ['fetch', '--all', '--prune']);
	if (!fetched) {
		addWarning('Could not fetch remote refs. Branch sync status may be stale.');
	}

	const upstreamCheck = runCommandCapture(gitBin, [
		'rev-parse',
		'--abbrev-ref',
		'--symbolic-full-name',
		'@{u}'
	]);
	if (!upstreamCheck.ok) {
		addWarning(
			'Current branch has no upstream configured. Skipping ahead/behind checks.',
			'Set an upstream branch: git branch --set-upstream-to origin/<branch>'
		);
		return;
	}

	const countsCheck = runCommandCapture(gitBin, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
	if (!countsCheck.ok) {
		addWarning('Failed to calculate branch ahead/behind status.');
		return;
	}

	const [aheadRaw, behindRaw] = countsCheck.stdout.trim().split(/\s+/);
	const ahead = Number(aheadRaw ?? '0');
	const behind = Number(behindRaw ?? '0');
	const upstreamBranch = upstreamCheck.stdout.trim();

	console.log(`[info] Ahead: ${ahead} | Behind: ${behind} (vs ${upstreamBranch})`);

	if (behind > 0) {
		if (hasLocalChanges) {
			addWarning(
				`Branch is ${behind} commit(s) behind ${upstreamBranch}, but pull was skipped due to local changes.`,
				'After commit/stash, run: git pull --ff-only'
			);
		} else {
			const pulled = runCommand('Fast-forward pull', gitBin, ['pull', '--ff-only']);
			if (!pulled) {
				addWarning(
					'Automatic fast-forward pull failed.',
					'Resolve branch divergence manually, then re-run pnpm catch-up.'
				);
			}
		}
	}

	if (ahead > 0) {
		addWarning(
			`Branch has ${ahead} local commit(s) not on ${upstreamBranch}.`,
			'Push local commits when ready: git push'
		);
	}
}

function runSetupValidation() {
	section('Setup Validation');

	if (!existsSync(resolve('package.json'))) {
		addError('package.json is missing from the repository root.');
	}

	if (!existsSync(resolve('wrangler.toml'))) {
		addError('wrangler.toml is missing from the repository root.');
	}

	if (!existsSync(resolve('pnpm-lock.yaml'))) {
		addError('pnpm-lock.yaml is missing. Clone may be incomplete or lockfile was removed.');
	}

	if (!existsSync(resolve('src/lib/database/migrations'))) {
		addError('Database migrations directory is missing: src/lib/database/migrations');
	}

	if (!existsSync(resolve('.env.example'))) {
		addError('.env.example is missing.');
	}

	const envExamplePath = resolve('.env.example');
	const envPath = resolve('.env');
	const devVarsPath = resolve('.dev.vars');

	const envExample = parseEnvFile(envExamplePath);
	const requiredEnvKeys = envExample
		? [...envExample.keys()]
		: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_DATABASE_ID', 'CLOUDFLARE_API_TOKEN'];

	validateEnvFile(envPath, requiredEnvKeys, {
		label: '.env',
		placeholderMap: envExample
	});

	const requiredDevVarsKeys = readAuthEnvKeys();
	validateEnvFile(devVarsPath, requiredDevVarsKeys, {
		label: '.dev.vars'
	});
}

function checkWranglerAuth() {
	section('Wrangler Check');

	const requiredWrangler = readDevDependencyVersion('wrangler') || 'declared in devDependencies';
	const versionCheck = runCommandCapture(pnpmBin, ['exec', 'wrangler', '--version']);
	if (!versionCheck.ok) {
		recordToolingVersion({
			name: 'wrangler',
			installed: 'not available',
			required: requiredWrangler,
			recommended: requiredWrangler,
			status: 'fail'
		});
		addWarning('Wrangler CLI is not available via project dependencies.');
		return false;
	}

	const installedWrangler = versionCheck.stdout.trim();
	console.log(`[info] ${installedWrangler}`);

	const authContext = getCloudflareAuthContext();

	if (authContext.hasApiToken) {
		const tokenWhoamiCheck = runCommandCapture(pnpmBin, ['exec', 'wrangler', 'whoami'], {
			env: buildCloudflareEnv(authContext)
		});
		if (!tokenWhoamiCheck.ok) {
			recordToolingVersion({
				name: 'wrangler',
				installed: installedWrangler,
				required: requiredWrangler,
				recommended: requiredWrangler,
				status: 'warn'
			});
			addWarning(
				`Cloudflare API token auth is configured via ${authContext.tokenSource}, but verification failed.`,
				'Verify CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID values and token permissions.'
			);
			return true;
		}

		recordToolingVersion({
			name: 'wrangler',
			installed: installedWrangler,
			required: requiredWrangler,
			recommended: requiredWrangler,
			status: 'pass'
		});
		console.log(`[info] Wrangler authentication detected via API token (${authContext.tokenSource}).`);
		return true;
	}

	const oauthWhoamiCheck = runCommandCapture(pnpmBin, ['exec', 'wrangler', 'whoami']);
	if (!oauthWhoamiCheck.ok) {
		recordToolingVersion({
			name: 'wrangler',
			installed: installedWrangler,
			required: requiredWrangler,
			recommended: requiredWrangler,
			status: 'warn'
		});
		addWarning(
			'Wrangler is not authenticated on this machine.',
			'Authenticate with: pnpm exec wrangler login (or set CLOUDFLARE_API_TOKEN in .env)'
		);
		return true;
	}

	recordToolingVersion({
		name: 'wrangler',
		installed: installedWrangler,
		required: requiredWrangler,
		recommended: requiredWrangler,
		status: 'pass'
	});
	console.log('[info] Wrangler authentication detected via OAuth login.');
	return true;
}

function verifyLocalD1State() {
	const d1Dir = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
	if (!existsSync(d1Dir)) {
		addWarning(
			'Local D1 state directory was not found after migration.',
			'If migrations succeeded but this persists, run pnpm db:migrate:local manually.'
		);
		return;
	}

	const sqliteFiles = readdirSync(d1Dir).filter((file) => file.endsWith('.sqlite'));
	if (sqliteFiles.length === 0) {
		addWarning(
			'No local D1 sqlite file was found after migration.',
			'Run pnpm db:migrate:local and verify wrangler local state directory permissions.'
		);
	}
}

function getLocalMigrationDatabaseName() {
	if (!packageJson?.scripts || typeof packageJson.scripts !== 'object') {
		return '';
	}

	const localMigrationScript = packageJson.scripts['db:migrate:local'];
	if (typeof localMigrationScript !== 'string') {
		return '';
	}

	const match = localMigrationScript.match(
		/wrangler\s+d1\s+migrations\s+apply\s+(".*?"|'.*?'|[^\s]+)\s+--local/
	);
	if (!match) {
		return '';
	}

	return match[1].replace(/^['"]|['"]$/g, '');
}

function runLocalD1Command(databaseName, sql) {
	return runCommandCapture(pnpmBin, [
		'exec',
		'wrangler',
		'd1',
		'execute',
		databaseName,
		'--local',
		'--command',
		`"${sql}"`
	]);
}

function readLocalProcessedMigrations(databaseName) {
	const queryResult = runLocalD1Command(databaseName, 'SELECT name FROM d1_migrations ORDER BY name;');
	if (!queryResult.ok) {
		return { ok: false, files: [] };
	}

	const payload = extractJsonPayload(queryResult.stdout);
	if (!Array.isArray(payload) || !Array.isArray(payload[0]?.results)) {
		return { ok: false, files: [] };
	}

	const processedFiles = payload[0].results
		.map((row) => (typeof row?.name === 'string' ? row.name : ''))
		.filter((name) => name.length > 0);
	return { ok: true, files: processedFiles };
}

function localTableHasColumn(databaseName, tableName, columnName) {
	const queryResult = runLocalD1Command(databaseName, `PRAGMA table_info('${tableName}');`);
	if (!queryResult.ok) {
		return null;
	}

	const payload = extractJsonPayload(queryResult.stdout);
	if (!Array.isArray(payload) || !Array.isArray(payload[0]?.results)) {
		return null;
	}

	return payload[0].results.some((row) => row?.name === columnName);
}

function reconcileLegacyLocalMigrations(databaseName) {
	const processed = readLocalProcessedMigrations(databaseName);
	if (!processed.ok) {
		addWarning(
			'Unable to read local migration history before migration apply.',
			'Run: pnpm exec wrangler d1 execute <db-name> --local --command "SELECT name FROM d1_migrations ORDER BY name;"'
		);
		return true;
	}

	const applied = new Set(processed.files);
	const hasLegacySeasonManagement = applied.has('0016_season_management_offering_scope.sql');
	const needsRenamed0015 = !applied.has('0015_long_millenium_guard.sql');
	const needsRenamed0016 = !applied.has('0016_foamy_talkback.sql');

	if (!hasLegacySeasonManagement || (!needsRenamed0015 && !needsRenamed0016)) {
		return true;
	}

	console.log(
		'[info] Reconciling local migration history: legacy season scope migration found without newer rename entries.'
	);

	if (needsRenamed0015) {
		const ensureRoutesTable = runLocalD1Command(
			databaseName,
			'CREATE TABLE IF NOT EXISTS client_database_routes (id text PRIMARY KEY NOT NULL, client_id text NOT NULL, route_mode text DEFAULT \'central_shared\' NOT NULL, binding_name text, database_id text, status text DEFAULT \'active\' NOT NULL, metadata text, created_at text NOT NULL, updated_at text NOT NULL, created_user text, updated_user text, FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE no action ON DELETE cascade);'
		);
		if (!ensureRoutesTable.ok) {
			addError('Failed to create local compatibility table client_database_routes.');
			return false;
		}

		const ensureRoutesUniqueIndex = runLocalD1Command(
			databaseName,
			'CREATE UNIQUE INDEX IF NOT EXISTS client_database_routes_client_unique ON client_database_routes (client_id);'
		);
		if (!ensureRoutesUniqueIndex.ok) {
			addError('Failed to create local compatibility index client_database_routes_client_unique.');
			return false;
		}

		const ensureRoutesStatusIndex = runLocalD1Command(
			databaseName,
			'CREATE INDEX IF NOT EXISTS client_database_routes_status_idx ON client_database_routes (status);'
		);
		if (!ensureRoutesStatusIndex.ok) {
			addError('Failed to create local compatibility index client_database_routes_status_idx.');
			return false;
		}

		const hasSelfJoinEnabled = localTableHasColumn(databaseName, 'clients', 'self_join_enabled');
		if (hasSelfJoinEnabled === null) {
			addError('Failed to inspect local clients columns for compatibility migration.');
			return false;
		}

		if (!hasSelfJoinEnabled) {
			const addSelfJoinEnabled = runLocalD1Command(
				databaseName,
				'ALTER TABLE clients ADD self_join_enabled integer DEFAULT 0 NOT NULL;'
			);
			if (!addSelfJoinEnabled.ok) {
				addError('Failed to add local compatibility column clients.self_join_enabled.');
				return false;
			}
		}

		const markRenamed0015 = runLocalD1Command(
			databaseName,
			"INSERT INTO d1_migrations (name) SELECT '0015_long_millenium_guard.sql' WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '0015_long_millenium_guard.sql');"
		);
		if (!markRenamed0015.ok) {
			addError('Failed to mark local compatibility migration 0015_long_millenium_guard.sql as applied.');
			return false;
		}
	}

	if (needsRenamed0016) {
		const ensureSlugIndex = runLocalD1Command(
			databaseName,
			"CREATE UNIQUE INDEX IF NOT EXISTS clients_slug_normalized_unique ON clients (lower(trim(slug))) WHERE slug IS NOT NULL AND trim(slug) <> '';"
		);
		if (!ensureSlugIndex.ok) {
			addError('Failed to create local compatibility index clients_slug_normalized_unique.');
			return false;
		}

		const markRenamed0016 = runLocalD1Command(
			databaseName,
			"INSERT INTO d1_migrations (name) SELECT '0016_foamy_talkback.sql' WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '0016_foamy_talkback.sql');"
		);
		if (!markRenamed0016.ok) {
			addError('Failed to mark local compatibility migration 0016_foamy_talkback.sql as applied.');
			return false;
		}
	}

	return true;
}

function collectLocalProcessedMigrations() {
	const databaseName = getLocalMigrationDatabaseName();
	if (!databaseName) {
		addWarning(
			'Could not determine local D1 database name from package.json script "db:migrate:local".',
			'Update scripts.db:migrate:local to follow: wrangler d1 migrations apply <db-name> --local'
		);
		return;
	}

	const processed = readLocalProcessedMigrations(databaseName);
	if (!processed.ok) {
		addWarning(
			'Unable to query local processed migrations from d1_migrations.',
			'Run: pnpm exec wrangler d1 execute <db-name> --local --command "SELECT name FROM d1_migrations ORDER BY name;"'
		);
		return;
	}
	summary.localProcessedMigrations = processed.files;
}

function printSummary() {
	section('Summary');

	const hasIssues = summary.errors.length > 0 || summary.warnings.length > 0;
	if (!hasIssues) {
		console.log(colorize('Catch-up complete. Environment looks good.', ansi.green));
	}

	if (summary.errors.length > 0) {
		console.log(`\n${colorize('Errors:', ansi.bold, ansi.red)}`);
		for (const message of summary.errors) {
			console.log(`- ${message}`);
		}
	}

	if (summary.warnings.length > 0) {
		console.log(`\n${colorize('Warnings:', ansi.bold, ansi.yellow)}`);
		for (const message of summary.warnings) {
			console.log(`- ${message}`);
		}
	}

	if (summary.actions.length > 0) {
		console.log(`\n${colorize('Suggested actions:', ansi.bold, ansi.cyan)}`);
		for (const action of summary.actions) {
			console.log(`- ${action}`);
		}
	}

	console.log(`\n${colorize('Tooling versions:', ansi.bold, ansi.cyan)}`);
	if (toolingVersions.length === 0) {
		console.log('- No tooling versions collected.');
	} else {
		for (const tool of toolingVersions) {
			const status = statusVisual(tool.status);
			const label = tool.name.padEnd(8, ' ');
			console.log(
				`- ${status} ${label} installed: ${tool.installed} | required: ${tool.required} | recommended: ${tool.recommended}`
			);
		}
	}

	console.log(`\n${colorize('Checks:', ansi.bold, ansi.cyan)}`);
	for (let index = 0; index < checkTimeline.length; index++) {
		const check = checkTimeline[index];
		console.log(`${index + 1}. ${checkIcon(check.status)} ${statusVisual(check.status)} ${check.name}`);
		if (check.details.length > 0) {
			console.log(`   ${colorize('->', ansi.gray)} ${check.details.join(' | ')}`);
		}
	}

	console.log(`\n${colorize('Local SQLite migrations processed:', ansi.bold, ansi.cyan)}`);
	console.log(`- Total processed: ${summary.localProcessedMigrations.length}`);
	if (summary.localProcessedMigrations.length === 0) {
		console.log('- No processed migration files were found in local d1_migrations.');
	} else {
		for (const fileName of summary.localProcessedMigrations) {
			console.log(`- ${fileName}`);
		}
	}
}

console.log('PlayIMs Catch-Up');
console.log(`Workspace: ${process.cwd()}`);
console.log(`Log file: ${logFilePath}`);

const nodeVersionCheck = startCheck('Node.js version');
const nodeOk = checkNodeVersion();
finishCheck(nodeVersionCheck, {
	ok: nodeOk,
	note: `installed: ${process.version} | required: >=${minNodeMajor} | recommended: >=${recommendedNodeMajor}`
});

const pnpmVersionCheck = startCheck('pnpm version');
const pnpmResult = runPnpmVersionCheck();
const packageManagerRequirement = readPackageManagerRequirement();
const requiredPnpmText = !Number.isNaN(packageManagerRequirement.major)
	? `major ${packageManagerRequirement.major}.x`
	: 'from packageManager';
const recommendedPnpmText = packageManagerRequirement.version || requiredPnpmText;
finishCheck(pnpmVersionCheck, {
	ok: pnpmResult.ok,
	note: `installed: ${pnpmResult.version || 'not found'} | required: ${requiredPnpmText} | recommended: ${recommendedPnpmText}`
});

const setupCheck = startCheck('Setup validation');
runSetupValidation();
finishCheck(setupCheck);

const gitSyncCheck = startCheck('Git sync');
runGitSync();
finishCheck(gitSyncCheck);

const installCheck = startCheck('Install dependencies');
const installOk = runCommand('Install dependencies', pnpmBin, ['install']);
if (!installOk) {
	addError('Dependency install failed.', 'Resolve install issues, then re-run pnpm catch-up.');
	finishCheck(installCheck, { ok: false });
} else {
	finishCheck(installCheck);

	const wranglerCheck = startCheck('Wrangler auth verification');
	const wranglerOk = checkWranglerAuth();
	finishCheck(wranglerCheck, { ok: wranglerOk });

	const migrationCheck = startCheck('Apply local migrations');
	const migrationDatabaseName = getLocalMigrationDatabaseName();
	let migrationPreparationOk = true;
	if (migrationDatabaseName) {
		migrationPreparationOk = reconcileLegacyLocalMigrations(migrationDatabaseName);
	}
	const migrationOk =
		migrationPreparationOk && runCommand('Apply local migrations', pnpmBin, ['db:migrate:local']);
	if (!migrationOk) {
		addError('Local database migration failed.', 'Run pnpm db:migrate:local after fixing migration issues.');
		finishCheck(migrationCheck, { ok: false });
	} else {
		verifyLocalD1State();
		collectLocalProcessedMigrations();
		finishCheck(migrationCheck);
	}

	const typeCheck = startCheck('Type check');
	const checkOk = runCommand('Run type checks', pnpmBin, ['check']);
	if (!checkOk) {
		addError('Type check failed.', 'Fix type issues and re-run pnpm check.');
		finishCheck(typeCheck, { ok: false });
	} else {
		finishCheck(typeCheck);
	}
}

printSummary();
console.log(`\nLog written to: ${logFilePath}`);
process.exitCode = summary.errors.length > 0 ? 1 : 0;

