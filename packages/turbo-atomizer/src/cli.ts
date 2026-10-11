#!/usr/bin/env node
const usage = 'Usage: turbo-atomizer <init|sync|doctor|merge-reports> [options]\n';
const isHelp = process.argv.includes('--help');

process.stdout.write(usage);
process.exitCode = isHelp ? 0 : 1;
