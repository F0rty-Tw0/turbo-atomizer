import { z } from 'zod';

import type { NonceLine, ProofLine, ServerMessage } from './server-protocol.type.ts';

const startingSchema = z.object({ state: z.literal('starting') });

const readySchema = z.object({ state: z.literal('ready'), env: z.record(z.string(), z.string()) });

const failedSchema = z.object({ state: z.literal('failed'), message: z.string(), logTail: z.string() });

export const serverMessageSchema = z.discriminatedUnion('state', [startingSchema, readySchema, failedSchema]) satisfies z.ZodType<ServerMessage>;

export const nonceLineSchema = z.object({ nonce: z.string().regex(/^[0-9a-f]{32}$/) }) satisfies z.ZodType<NonceLine>;

export const proofLineSchema = z.object({ proof: z.string().regex(/^[0-9a-f]{64}$/) }) satisfies z.ZodType<ProofLine>;
