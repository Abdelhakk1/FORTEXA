import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env/server";

function assertSupabasePublicEnv() {
  if (
    !serverEnv.nextPublicSupabaseUrl ||
    !serverEnv.nextPublicSupabaseAnonKey
  ) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
}

export async function createSupabaseServerClient() {
  assertSupabasePublicEnv();

  const cookieStore = await cookies();

  return createServerClient(
    serverEnv.nextPublicSupabaseUrl!,
    serverEnv.nextPublicSupabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components may not be allowed to write cookies.
          }
        },
      },
    }
  );
}

export function createSupabaseProxyClient(request: NextRequest) {
  assertSupabasePublicEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    serverEnv.nextPublicSupabaseUrl!,
    serverEnv.nextPublicSupabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }: {
              name: string;
              value: string;
              options: CookieOptions;
            }) => {
              response.cookies.set(name, value, options);
            }
          );
        },
      },
    }
  );

  return {
    supabase,
    getResponse() {
      return response;
    },
  };
}
