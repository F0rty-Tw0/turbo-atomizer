// TEMPORARY CI probe (PR #9, S1): runs as the web package's build task, so everything here runs inside a turbo task, and
// again straight from vitest (argv[2] = 'direct'). It times variants of the WMI launch to find why powershell hangs.
const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const VARIANT_TIMEOUT_MS = 20_000;
const where = process.argv[2] ?? 'turbo';

const TAIL = [
  '$startupProperties = @{ EnvironmentVariables = [string[]]$request.env; ShowWindow = [uint16]0 }',
  '$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property $startupProperties',
  '$arguments = @{ CommandLine = $request.commandLine; CurrentDirectory = $request.cwd; ProcessStartupInformation = $startup }',
  '$created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments $arguments',
  '$result = @{ returnValue = [int]$created.ReturnValue; processId = [int]$created.ProcessId }',
  '[Console]::Out.Write((ConvertTo-Json -Compress -InputObject $result))'
];

const tail = (statements) => ["$ErrorActionPreference = 'Stop'", ...statements, ...TAIL].join('; ');

const SCRIPTS = {
  streamReader: tail([
    '$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)',
    '$request = $reader.ReadToEnd() | ConvertFrom-Json'
  ]),
  consoleIn: tail(['$request = [Console]::In.ReadToEnd() | ConvertFrom-Json']),
  input: tail(['$request = ($input | Out-String) | ConvertFrom-Json']),
  envVar: tail(['$request = $env:TA_PROBE_LAUNCH | ConvertFrom-Json'])
};

const request = JSON.stringify({
  commandLine: `"${process.execPath}" "-e" "0"`,
  cwd: __dirname,
  env: Object.entries(process.env).map(([key, value]) => `${key}=${value}`)
});

const run = (name, viaEnv) =>
  new Promise((resolve) => {
    const started = Date.now();
    const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', SCRIPTS[name]];
    const env = viaEnv ? { ...process.env, TA_PROBE_LAUNCH: request } : process.env;
    const stdio = viaEnv ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'];
    const child = spawn('powershell.exe', args, { env, stdio, timeout: VARIANT_TIMEOUT_MS, windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => resolve({ name, ms: Date.now() - started, error: String(error) }));
    child.on('close', (code, signal) => resolve({ name, ms: Date.now() - started, code, signal, stdout, stderr: stderr.slice(-300) }));

    if (!viaEnv) {
      child.stdin.on('error', () => undefined);
      child.stdin.end(request);
    }
  });

const main = async () => {
  const results = [];

  results.push(await run('consoleIn', false));
  results.push(await run('streamReader', false));
  results.push(await run('input', false));
  results.push(await run('envVar', true));
  results.push(await run('consoleIn', false));

  const parallel = await Promise.all([1, 2, 3, 4, 5, 6].map(() => run('streamReader', false)));

  writeFileSync(join(__dirname, `probe-${where}.json`), JSON.stringify({ results, parallel }));
};

main();
