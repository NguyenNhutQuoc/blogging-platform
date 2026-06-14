import { cookies } from "next/headers";
import { Users as UsersIcon } from "lucide-react";
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
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

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string }>;
}) {
  const { search, role } = await searchParams;
  const result = await fetchUsers(search, role);

  return (
    <div className="space-y-5">
      <PageHeader title="Users" description={`${result?.meta.total ?? 0} total users`} />

      <form className="flex flex-wrap gap-2">
        <Input
          name="search"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="h-8 w-64 text-sm"
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="author">Author</option>
          <option value="subscriber">Subscriber</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>

      {!result || result.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <UsersIcon className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <StatusBadge status={user.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <UserActions userId={user.id} currentRole={user.role} currentStatus={user.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
