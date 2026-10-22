import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refresh sesi Supabase dan lindungi route /admin. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const path = request.nextUrl.pathname;
  const isAdminArea = path.startsWith("/admin") && !path.startsWith("/admin/login");

  if (!url || !anon) {
    // Tanpa Supabase admin tidak bisa dipakai — arahkan ke halaman login yang menjelaskan setup.
    if (isAdminArea) return NextResponse.redirect(new URL("/admin/login", request.url));
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAdminArea && !user) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return response;
}
