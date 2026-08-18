import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createServerClient(
    supabaseUrl,
    publishableKey,
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
            // The `setAll` method was called from a Server Component or Route
            // Handler where cookies cannot be set (e.g. DELETE/PATCH handlers
            // in Next.js 15). The session refresh is best-effort; the next
            // request will retry with the existing (still-valid) token.
          }
        },
      },
    }
  );
}

export async function getCurrentUser(supabase?: SupabaseClient) {
  const client = supabase ?? (await createClient());
  const { data: { user } } = await client.auth.getUser();
  return user;
}
