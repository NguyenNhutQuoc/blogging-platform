import { cookies } from "next/headers";
import { Card, CardContent, CardHeader } from "@repo/ui";
import { UserActions } from "./UserActions";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

async function fetchUsers(search?: string, role?: string): Promise<UsersResponse | null> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const params = new URLSearchParams({ pageSize: "50" });
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    const res = await fetch(`${API_URL}/api/v1/admin/users?${params}`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<UsersResponse>;
  } catch { return null; }
}

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  editor: "bg-purple-100 text-purple-700",
  author: "bg-blue-100 text-blue-700",
  subscriber: "bg-gray-100 text-gray-700",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-yellow-100 text-yellow-700",
  banned: "bg-red-100 text-red-700",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string }>;
}) {
  const { search, role } = await searchParams;
  const result = await fetchUsers(search, role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {result?.meta.total ?? 0} total users
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <form className="flex gap-2 flex-wrap">
            <input
              name="search"
              defaultValue={search}
              placeholder="Search by name or email..."
              className="border rounded-md px-3 py-1.5 text-sm flex-1 min-w-[200px]"
            />
            <select
              name="role"
              defaultValue={role ?? ""}
              className="border rounded-md px-3 py-1.5 text-sm"
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="author">Author</option>
              <option value="subscriber">Subscriber</option>
            </select>
            <button type="submit" className="border rounded-md px-3 py-1.5 text-sm bg-primary text-primary-foreground">
              Filter
            </button>
          </form>
        </CardHeader>
        <CardContent>
          {!result || result.data.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Joined</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{user.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] ?? ""}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[user.status] ?? ""}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <UserActions userId={user.id} currentRole={user.role} currentStatus={user.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
