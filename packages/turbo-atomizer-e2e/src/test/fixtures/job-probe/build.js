// TEMPORARY CI probe (PR #9, S1): runs as the web package's build task, so everything here runs inside a turbo task, and
// again straight from vitest (argv[2] = 'direct'). Every powershell launch hung inside turbo but took ~370 ms outside, so
// this measures real durations (long timeout) of launches with and without cmdlets, pure .NET WMI, and VBScript WMI.
const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const VARIANT_TIMEOUT_MS = 100_000;
const where = process.argv[2] ?? 'turbo';
const PS_ARGS = ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command'];
const PS_HOME_MODULES = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32\\WindowsPowerShell\\v1.0\\Modules');

const CIM = [
  "$ErrorActionPreference = 'Stop'",
  '$request = [Console]::In.ReadToEnd() | ConvertFrom-Json',
  '$startupProperties = @{ EnvironmentVariables = [string[]]$request.env; ShowWindow = [uint16]0 }',
  '$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property $startupProperties',
  '$arguments = @{ CommandLine = $request.commandLine; CurrentDirectory = $request.cwd; ProcessStartupInformation = $startup }',
  '$created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments $arguments',
  '$result = @{ returnValue = [int]$created.ReturnValue; processId = [int]$created.ProcessId }',
  '[Console]::Out.Write((ConvertTo-Json -Compress -InputObject $result))'
].join('; ');

const DOTNET_WMI = [
  "$ErrorActionPreference = 'Stop'",
  '$text = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8).ReadToEnd()',
  '$parts = $text.Split([char]0)',
  "$startup = ([wmiclass]'Win32_ProcessStartup').CreateInstance()",
  '$startup.ShowWindow = [uint16]0',
  '$startup.EnvironmentVariables = [string[]]($parts | Select-Object -Skip 2)',
  "$created = ([wmiclass]'Win32_Process').Create($parts[0], $parts[1], $startup)",
  "[Console]::Out.Write('{\"returnValue\":' + $created.ReturnValue + ',\"processId\":' + $created.ProcessId + '}')"
].join('; ');

// Select-Object is a cmdlet; this one avoids it with a plain array slice
const DOTNET_WMI_NO_CMDLET = DOTNET_WMI.replace('($parts | Select-Object -Skip 2)', '$parts[2..($parts.Length - 1)]');

const BARE = "[Console]::Out.Write('ok')";

const env = Object.entries(process.env).map(([key, value]) => `${key}=${value}`);
const commandLine = `"${process.execPath}" "-e" "0"`;
const jsonRequest = JSON.stringify({ commandLine, cwd: __dirname, env });
const nulRequest = [commandLine, __dirname, ...env].join('\0');
const lineRequest = [commandLine, __dirname, ...env.filter((entry) => !entry.includes('\n'))].join('\n');

const run = (name, exe, args, stdin, extraEnv = {}) =>
  new Promise((resolve) => {
    const started = Date.now();
    const childEnv = { ...process.env, ...extraEnv };
    const child = spawn(exe, args, { env: childEnv, timeout: VARIANT_TIMEOUT_MS, windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => resolve({ name, ms: Date.now() - started, error: String(error) }));
    child.on('close', (code, signal) =>
      resolve({ name, ms: Date.now() - started, code, signal, stdout: stdout.slice(0, 200), stderr: stderr.slice(-400) })
    );
    child.stdin.on('error', () => undefined);
    child.stdin.end(stdin);
  });

const VARIANTS = {
  bare: () => run('bare', 'powershell.exe', [...PS_ARGS, BARE], ''),
  dotnetWmiNoCmdlet: () => run('dotnetWmiNoCmdlet', 'powershell.exe', [...PS_ARGS, DOTNET_WMI_NO_CMDLET], nulRequest),
  vbs: () => run('vbs', 'cscript.exe', ['//NoLogo', join(__dirname, 'launch.vbs')], lineRequest),
  dotnetWmi: () => run('dotnetWmi', 'powershell.exe', [...PS_ARGS, DOTNET_WMI], nulRequest),
  cimPsHomeModules: () => run('cimPsHomeModules', 'powershell.exe', [...PS_ARGS, CIM], jsonRequest, { PSModulePath: PS_HOME_MODULES }),
  cim: () => run('cim', 'powershell.exe', [...PS_ARGS, CIM], jsonRequest)
};

const ORDER = {
  turbo: ['bare', 'bare', 'dotnetWmiNoCmdlet', 'vbs', 'vbs', 'dotnetWmi', 'cimPsHomeModules', 'cim', 'cim'],
  direct: ['bare', 'dotnetWmiNoCmdlet', 'vbs', 'dotnetWmi', 'cim']
};

const main = async () => {
  const results = [];
  const envNames = Object.keys(process.env).sort();

  for (const name of ORDER[where]) {
    results.push(await VARIANTS[name]());
    writeFileSync(join(__dirname, `probe-${where}.json`), JSON.stringify({ envNames, results }));
  }
};

main();
