// TEMPORARY CI probe (PR #9, S1): reports what env and cwd it got, writes one stdout line, then sleeps.
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const name = process.argv[2];
const report = {
  pid: process.pid,
  mark: process.env.PROBE_MARK ?? null,
  userProfile: process.env.USERPROFILE ?? null,
  hasPath: Boolean(process.env.PATH),
  turboHash: process.env.TURBO_HASH ?? null,
  envCount: Object.keys(process.env).length,
  cwd: process.cwd()
};

writeFileSync(join(__dirname, `sleeper-${name}.json`), JSON.stringify(report));
process.stdout.write(`sleeper ${name} stdout\n`);
setTimeout(() => {}, 120_000);
