export const ATOMIZER_BLOB_FLAG = '--atomizer-blob';

export const ADD_REPORTER_OPTION = '--add-reporter';

export const CONFIG_OPTIONS = ['-c', '--config'];

export const VALUE_OPTIONS = [
  '--add-reporter',
  '--browser',
  '-c',
  '--config',
  '--global-timeout',
  '-g',
  '--grep',
  '-G',
  '--grep-invert',
  '--last-failed-file',
  '--max-failures',
  '--output',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--run-agents',
  '--shard',
  '--test-list',
  '--test-list-invert',
  '--timeout',
  '--trace',
  '--tsconfig',
  '--ui-host',
  '--ui-port',
  '--update-source-method',
  '-j',
  '--workers'
];

export const OPTIONAL_VALUE_OPTIONS = ['--debug', '--only-changed', '--shuffle', '-u', '--update-snapshots'];

export const VARIADIC_OPTIONS = ['--project'];

export const FILTER_OPTIONS = ['-g', '--grep', '-G', '--grep-invert', '--project', '--last-failed', '--only-changed', '--shard'];
