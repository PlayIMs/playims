import { execFileSync, execSync } from 'node:child_process';

const rawPort = process.argv[2] ?? '4983';
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
	console.error(`Invalid port: ${rawPort}`);
	process.exit(1);
}

function killOnWindows(targetPort) {
	const script = `
		$pids = Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
		if (-not $pids) {
			Write-Output "No listener on port ${targetPort}"
			exit 0
		}
		foreach ($procId in $pids) {
			try {
				Stop-Process -Id $procId -Force -ErrorAction Stop
				Write-Output "Stopped PID $procId on port ${targetPort}"
			} catch {
				Write-Output "Failed to stop PID $procId on port ${targetPort}: $($_.Exception.Message)"
			}
		}
	`;

	execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' });
}

function killOnUnix(targetPort) {
	let output = '';
	try {
		output = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, { encoding: 'utf8' });
	} catch {
		console.log(`No listener on port ${targetPort}`);
		return;
	}

	const pids = output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (pids.length === 0) {
		console.log(`No listener on port ${targetPort}`);
		return;
	}

	execSync(`kill -9 ${pids.join(' ')}`, { stdio: 'inherit' });
	console.log(`Stopped PID(s) ${pids.join(', ')} on port ${targetPort}`);
}

if (process.platform === 'win32') {
	killOnWindows(port);
} else {
	killOnUnix(port);
}
