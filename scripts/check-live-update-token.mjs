import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";
import "dotenv/config";

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function createCookieHeader() {
  const cookies = [];
  const supabase = createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookies;
        },
        setAll(nextCookies) {
          for (const nextCookie of nextCookies) {
            const index = cookies.findIndex(
              (cookie) => cookie.name === nextCookie.name
            );

            if (index >= 0) {
              cookies[index] = nextCookie;
            } else {
              cookies.push(nextCookie);
            }
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: getRequiredEnv("FORTEXA_TEST_EMAIL"),
    password: getRequiredEnv("FORTEXA_TEST_PASSWORD"),
  });

  if (error) {
    throw error;
  }

  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function getToken(cookieHeader) {
  const baseUrl = process.env.FORTEXA_BASE_URL?.trim() || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/live-updates`, {
    headers: {
      cookie: cookieHeader,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  return payload.token;
}

const cookieHeader = await createCookieHeader();
const beforeToken = await getToken(cookieHeader);

const sql = postgres(getRequiredEnv("DATABASE_URL"), {
  prepare: false,
  max: 1,
});

await sql`update assets set updated_at = now() where id = (select id from assets order by created_at asc limit 1)`;
await sql.end();

const afterToken = await getToken(cookieHeader);

console.log(
  JSON.stringify(
    {
      beforeToken,
      afterToken,
      changed: beforeToken !== afterToken,
    },
    null,
    2
  )
);
