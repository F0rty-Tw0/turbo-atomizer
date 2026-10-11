import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { probeServer } from './probe.http.ts';
import type { WebServerFact } from '../../shared/atomizer/common/atomizer.type.ts';
import type { StaticServer } from '../test/common/server.type.ts';
import { WEB_SERVER_FACT_STUB } from '../test/stubs/web-server.stub.ts';
import { freePort, startStaticServer } from '../test/utils/static-server.spec.util.ts';

const urlFact = (url: string): WebServerFact => {
  const fact: WebServerFact = { ...WEB_SERVER_FACT_STUB, url };

  return fact;
};

const portFact = (port: number): WebServerFact => {
  const fact: WebServerFact = { ...WEB_SERVER_FACT_STUB, port };

  return fact;
};

describe('FEATURE: server probe', (): void => {
  describe('GIVEN an HTTP server on 127.0.0.1', (): void => {
    let server: StaticServer;
    let origin: string;

    beforeAll(async (): Promise<void> => {
      server = await startStaticServer(['--host', '127.0.0.1']);
      origin = `http://127.0.0.1:${String(server.port)}`;
    });

    afterAll(async (): Promise<void> => {
      await server.stop();
    });

    it('WHEN the url is / answering 404 with /index.html answering 200 THEN it is ready', async (): Promise<void> => {
      const isReady = await probeServer(urlFact(`${origin}/`));

      expect(isReady).toBe(true);
    });

    it('WHEN the url is /r redirecting to /index.html THEN it is ready', async (): Promise<void> => {
      const isReady = await probeServer(urlFact(`${origin}/r`));

      expect(isReady).toBe(true);
    });

    it('WHEN the url redirects to a 404 THEN the redirect is followed and it is not ready', async (): Promise<void> => {
      const isReady = await probeServer(urlFact(`${origin}/r-missing`));

      expect(isReady).toBe(false);
    });

    it('WHEN the url redirects to a Location no URL parser accepts THEN the 302 is the answer and it is ready', async (): Promise<void> => {
      const isReady = await probeServer(urlFact(`${origin}/r-invalid`));

      expect(isReady).toBe(true);
    });

    it('WHEN the url is a 404 other than / THEN /index.html is not tried and it is not ready', async (): Promise<void> => {
      const isReady = await probeServer(urlFact(`${origin}/missing`));

      expect(isReady).toBe(false);
    });

    it('WHEN only its port is probed THEN it is ready', async (): Promise<void> => {
      const isReady = await probeServer(portFact(server.port));

      expect(isReady).toBe(true);
    });
  });

  describe('GIVEN an HTTPS server with a self-signed certificate', (): void => {
    let server: StaticServer;
    let url: string;

    beforeAll(async (): Promise<void> => {
      server = await startStaticServer(['--tls']);
      url = `https://127.0.0.1:${String(server.port)}/index.html`;
    });

    afterAll(async (): Promise<void> => {
      await server.stop();
    });

    it('WHEN ignoreHTTPSErrors is off THEN it is not ready', async (): Promise<void> => {
      const isReady = await probeServer(urlFact(url));

      expect(isReady).toBe(false);
    });

    it('WHEN ignoreHTTPSErrors is on THEN it is ready', async (): Promise<void> => {
      const plain = urlFact(url);
      const fact: WebServerFact = { ...plain, ignoreHTTPSErrors: true };

      const isReady = await probeServer(fact);

      expect(isReady).toBe(true);
    });
  });

  describe('GIVEN a server bound to ::1 only', (): void => {
    let server: StaticServer;

    beforeAll(async (): Promise<void> => {
      server = await startStaticServer(['--host', '::1']);
    });

    afterAll(async (): Promise<void> => {
      await server.stop();
    });

    it('WHEN its port is probed THEN it is ready', async (): Promise<void> => {
      const isReady = await probeServer(portFact(server.port));

      expect(isReady).toBe(true);
    });
  });

  describe('GIVEN nothing bound to the port', (): void => {
    let port: number;

    beforeAll(async (): Promise<void> => {
      port = await freePort();
    });

    it('WHEN its port is probed THEN it is not ready', async (): Promise<void> => {
      const isReady = await probeServer(portFact(port));

      expect(isReady).toBe(false);
    });

    it('WHEN a url on it is probed THEN it is not ready', async (): Promise<void> => {
      const isReady = await probeServer(urlFact(`http://127.0.0.1:${String(port)}/`));

      expect(isReady).toBe(false);
    });
  });

  describe('GIVEN a server with neither url nor port', (): void => {
    it('WHEN it is probed THEN it is not ready', async (): Promise<void> => {
      const isReady = await probeServer(WEB_SERVER_FACT_STUB);

      expect(isReady).toBe(false);
    });
  });
});
