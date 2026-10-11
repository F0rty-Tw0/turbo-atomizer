// Usage: node server.js <port> [log name]. Appends its pid to <workspace root>/.atomizer/<log name>.log on start.
const { appendFileSync, mkdirSync, readFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { join } = require('node:path');

const [port, logName = 'starts'] = process.argv.slice(2);
const logDir = join(__dirname, '..', '..', '.atomizer');
const page = readFileSync(join(__dirname, 'dist', 'index.html'));

mkdirSync(logDir, { recursive: true });
appendFileSync(join(logDir, `${logName}.log`), `${process.pid}\n`);

const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(page);
});

server.listen(Number(port), '127.0.0.1');
