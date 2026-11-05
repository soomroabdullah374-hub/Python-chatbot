// Minimal ambient types for the Supabase Edge Runtime AI API used by CodeBloom (gte-small embeddings).
// The upstream jsr:@supabase/functions-js/edge-runtime.d.ts is loaded as a module by `deno check`,
// so its globals are not visible; this local script declaration covers exactly what we call.
declare namespace Supabase {
  namespace ai {
    class Session {
      constructor(model: 'gte-small' | string);
      run(input: string, options?: { mean_pool?: boolean; normalize?: boolean }): Promise<unknown>;
    }
  }
}
