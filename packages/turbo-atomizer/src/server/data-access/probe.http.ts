import type { IncomingMessage } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect } from 'node:net';

import type { WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import { MAX_PROBE_REDIRECTS, PROBE_REQUEST_TIMEOUT_MS } from '../common/server.const.ts';
import { isReadyStatus } from '../utils/probe-status.util.ts';

const NO_STATUS = 0;

type StatusRequest = {
  readonly url: URL;
  readonly ignoreHTTPSErrors: boolean;
  readonly redirects: number;
};

/** Undefined when the response is the answer: not a redirect, out of hops, or a `Location` no URL parser accepts. */
const redirectTarget = (response: IncomingMessage, current: StatusRequest): StatusRequest | undefined => {
  const status = response.statusCode ?? NO_STATUS;
  const location = response.headers.location;
  const isRedirect = status >= 300 && status < 400;
  const canFollow = isRedirect && location !== undefined && current.redirects < MAX_PROBE_REDIRECTS;

  if (!canFollow) return undefined;

  const url = URL.parse(location, current.url.href);

  if (url === null) return undefined;

  const next: StatusRequest = { ...current, url, redirects: current.redirects + 1 };

  return next;
};

/** GET with Playwright's semantics: redirects followed, any network or TLS error is status 0. */
const statusOf = async (current: StatusRequest): Promise<number> => {
  const send = current.url.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers = { Accept: '*/*' };
  const signal = AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS);
  const options = { headers, rejectUnauthorized: !current.ignoreHTTPSErrors, signal };

  return new Promise((resolve): void => {
    const onResponse = (response: IncomingMessage): void => {
      response.resume();

      const next = redirectTarget(response, current);

      if (next === undefined) return void resolve(response.statusCode ?? NO_STATUS);

      void statusOf(next).then(resolve);
    };

    const outgoing = send(current.url, options, onResponse);

    outgoing.on('error', (): void => resolve(NO_STATUS));
    outgoing.end();
  });
};

const probeUrl = async (url: URL, ignoreHTTPSErrors: boolean): Promise<boolean> => {
  const first: StatusRequest = { url, ignoreHTTPSErrors, redirects: 0 };
  const status = await statusOf(first);
  const isRootMiss = status === 404 && url.pathname === '/';

  if (!isRootMiss) return isReadyStatus(status);

  const indexUrl = new URL('/index.html', url);
  const index: StatusRequest = { ...first, url: indexUrl };
  const indexStatus = await statusOf(index);

  return isReadyStatus(indexStatus);
};

const canConnect = async (port: number, host: string): Promise<boolean> => {
  return new Promise((resolve): void => {
    const socket = connect(port, host);

    const settle = (isOpen: boolean): void => {
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(PROBE_REQUEST_TIMEOUT_MS, (): void => settle(false));
    socket.once('connect', (): void => settle(true));
    socket.once('error', (): void => settle(false));
  });
};

/** Playwright's `isPortUsed`: a TCP connect to 127.0.0.1 or ::1 succeeds. */
const probePort = async (port: number): Promise<boolean> => {
  const results = await Promise.all([canConnect(port, '127.0.0.1'), canConnect(port, '::1')]);

  return results.includes(true);
};

/** One readiness check of a webServer entry: `url` wins over `port`; an entry with neither is never ready. */
export const probeServer = async (fact: WebServerFact): Promise<boolean> => {
  if (fact.url !== undefined) {
    const url = new URL(fact.url);

    return probeUrl(url, fact.ignoreHTTPSErrors ?? false);
  }

  if (fact.port !== undefined) return probePort(fact.port);

  return false;
};
