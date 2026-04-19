import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AdminNav } from "@/components/AdminNav";

/**
 * Admin section layout.
 * Validates the session server-side on every navigation.
 * Redirects to /login if the session is missing or the user lacks admin/editor role.
 *
 * We forward the Cookie header to the API so Better Auth can validate the session.
 * This runs entirely on the server — no client-side flash of protected content.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav user={session.user} />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {children}
      </main>
    </div>
  );
}

type SessionUser = { id: string; name: string; email: string; role?: string };
type SessionData = { user: SessionUser; session: { id: string } };

async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const API_URL = process.env.API_URL ?? "http://localhost:3001";
    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json() as SessionData | null;
    if (!data?.user) return null;

    // Only allow admin and editor roles
    const role = (data.user as { role?: string }).role;
    if (role !== "admin" && role !== "editor") return null;

    return data;
  } catch {
    return null;
  }
}
