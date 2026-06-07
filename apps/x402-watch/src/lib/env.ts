import { z } from "zod";

const schema = z.object({
  AMP_ORIGIN: z.string().url(),
  AMP_TOKEN: z.string().min(16),
  AMP_DATASET: z.string().default("_/base_mainnet@2.0.0"),
  AMP_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

type Env = z.infer<typeof schema>;

// Lazy proxy — validate on first access, not at module load. Vercel's
// build step imports route modules to collect page data BEFORE injecting
// env vars, so eager parsing throws and fails the build.
let cached: Env | null = null;
function load(): Env {
  if (cached) return cached;
  cached = schema.parse({
    AMP_ORIGIN: process.env.AMP_ORIGIN,
    AMP_TOKEN: process.env.AMP_TOKEN,
    AMP_DATASET: process.env.AMP_DATASET,
    AMP_QUERY_TIMEOUT_MS: process.env.AMP_QUERY_TIMEOUT_MS,
  });
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_, key: string | symbol) {
    return load()[key as keyof Env];
  },
});
