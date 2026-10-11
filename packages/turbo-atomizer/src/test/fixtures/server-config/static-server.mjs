import { appendFileSync, readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const options = {
  delay: { type: 'string', default: '0' },
  host: { type: 'string', default: '127.0.0.1' },
  port: { type: 'string', default: '0' },
  'starts-log': { type: 'string' },
  tls: { type: 'boolean', default: false }
};
const { values } = parseArgs({ options });

const routes = {
  '/index.html': [200, {}],
  '/r': [302, { location: '/index.html' }],
  '/r-missing': [302, { location: '/missing' }]
};

const handle = (request, response) => {
  const [status, headers] = routes[request.url] ?? [404, {}];

  response.writeHead(status, headers);
  response.end(String(status));
};

const tlsDir = join(import.meta.dirname, 'tls');
const tlsOptions = () => ({ cert: readFileSync(join(tlsDir, 'cert.pem')), key: readFileSync(join(tlsDir, 'key.pem')) });
const server = values.tls ? createHttpsServer(tlsOptions(), handle) : createHttpServer(handle);

if (values['starts-log'] !== undefined) appendFileSync(values['starts-log'], `${process.pid}\n`);

await sleep(Number(values.delay));

server.listen(Number(values.port), values.host, () => {
  console.log(`ready on ${server.address().port}`);
});
