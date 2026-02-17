declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }

  function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module 'npm:@supabase/supabase-js@2' {
  export const createClient: (...args: any[]) => any;
}

declare module 'npm:stripe@14.25.0' {
  const Stripe: any;
  export default Stripe;
}
