import { z } from "zod";

const schema = z.object({
  AMP_ORIGIN: z.string().url(),
  AMP_TOKEN: z.string().min(16),
  AMP_DATASET: z.string().default("_/base_mainnet@2.0.0"),
  AMP_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

export const env = schema.parse({
  AMP_ORIGIN: process.env.AMP_ORIGIN,
  AMP_TOKEN: process.env.AMP_TOKEN,
  AMP_DATASET: process.env.AMP_DATASET,
  AMP_QUERY_TIMEOUT_MS: process.env.AMP_QUERY_TIMEOUT_MS,
});
