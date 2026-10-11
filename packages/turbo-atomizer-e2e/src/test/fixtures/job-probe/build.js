// TEMPORARY CI probe (PR #9, S1): runs as the web package's build task, so everything here runs inside a turbo task.
const { execFileSync, spawn } = require('node:child_process');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const ps = (mode, input) => {
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(__dirname, 'probe.ps1'), mode];
  const stdin = input === undefined ? '' : JSON.stringify(input);
  const stdout = execFileSync('powershell.exe', args, { input: stdin, windowsHide: true }).toString();

  return JSON.parse(stdout);
};

const quoted = (arg) => `"${arg}"`;

const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const waitForJson = (file) => {
  const path = join(__dirname, file);
  const end = Date.now() + 15_000;

  while (!existsSync(path) && Date.now() < end) sleepMs(100);
  sleepMs(200);

  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
};

const timed = (fn) => {
  const start = Date.now();
  const value = fn();

  return { value, ms: Date.now() - start };
};

const report = {};
const self = timed(() => ps('self'));

report.self = self.value;
report.psSelfMs = self.ms;

const detached = spawn(process.execPath, [join(__dirname, 'sleeper.cjs'), 'detached'], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true
});

detached.unref();
report.detachedPid = detached.pid;

const minimalEnv = ['PROBE_MARK=1', `SystemRoot=${process.env.SystemRoot}`];
const cimSleeper = `${quoted(process.execPath)} ${quoted(join(__dirname, 'sleeper.cjs'))} cim`;
const cim = timed(() => ps('create', { commandLine: cimSleeper, cwd: __dirname, env: minimalEnv }));

report.cim = cim.value;
report.cimMs = cim.ms;

const fullEnv = Object.entries(process.env).map(([key, value]) => `${key}=${value}`);
const hopCommand = `${quoted(process.execPath)} ${quoted(join(__dirname, 'hop.cjs'))}`;
const hop = timed(() => ps('create', { commandLine: hopCommand, cwd: __dirname, env: [...fullEnv, 'PROBE_MARK=hop'] }));

report.hop = hop.value;
report.hopMs = hop.ms;
report.cimEnv = waitForJson('sleeper-cim.json');
report.hopChild = waitForJson('hop.json');
report.hopChildEnv = waitForJson('sleeper-hop-child.json');
report.taskEnvCount = fullEnv.length;

const pids = [report.detachedPid, report.cim.processId, report.hopChild?.pid].filter(Boolean);

report.inJob = ps('pids', { pids });
writeFileSync(join(__dirname, 'probe.json'), JSON.stringify(report));
