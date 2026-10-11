const { cpSync } = require('node:fs');
const { join } = require('node:path');

cpSync(join(__dirname, 'src'), join(__dirname, 'dist'), { recursive: true });
