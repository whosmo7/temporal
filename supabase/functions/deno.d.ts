// The slice of the Deno runtime the Edge Functions use, for tsc only (see tsconfig.json). Deno has
// its own types and never loads this file.

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: { get(key: string): string | undefined };
};
