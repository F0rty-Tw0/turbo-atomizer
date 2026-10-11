import { z } from 'zod';

import type { ServerMessage } from './server-protocol.type.ts';

const startingSchema = z.object({ state: z.literal('starting') });

const readySchema = z.object({ state: z.literal('ready'), env: z.record(z.string(), z.string()) });

const failedSchema = z.object({ state: z.literal('failed'), message: z.string(), logTail: z.string() });

export const serverMessageSchema = z.discriminatedUnion('state', [startingSchema, readySchema, failedSchema]) satisfies z.ZodType<ServerMessage>;
