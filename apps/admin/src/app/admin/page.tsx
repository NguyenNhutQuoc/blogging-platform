import { redirect } from "next/navigation";

/** Admin root — redirect straight to posts list */
export default function AdminPage() {
  redirect("/admin/posts");
}
