declare namespace Deno {
  namespace env {
    function get(name: string): string | undefined;
  }

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}

declare module "npm:@supabase/supabase-js@2" {
  export function createClient(...args: unknown[]): any;
}

declare module "npm:jose@5.10.0" {
  export class SignJWT {
    constructor(payload?: Record<string, unknown>);

    setProtectedHeader(header: Record<string, unknown>): this;

    setIssuer(issuer: string): this;

    setSubject(subject: string): this;

    setAudience(audience: string): this;

    setIssuedAt(value: number): this;

    setExpirationTime(value: number | string): this;

    sign(key: unknown): Promise<string>;
  }

  export function importPKCS8(key: string, algorithm: string): Promise<unknown>;
}

declare module "npm:postgres@3.4.7" {
  const postgres: any;
  export default postgres;
}
