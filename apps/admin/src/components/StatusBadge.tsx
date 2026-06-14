import { Badge } from "@repo/ui";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

/**
 * Single source of truth mapping domain statuses to Badge variants,
 * replacing per-page hardcoded color classes that broke in dark mode.
 */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // post status
  published: "success",
  draft: "secondary",
  scheduled: "outline",
  archived: "destructive",
  // comment status
  approved: "success",
  pending: "warning",
  rejected: "destructive",
  spam: "destructive",
  // user role
  admin: "default",
  editor: "outline",
  author: "secondary",
  subscriber: "secondary",
  // user status
  active: "success",
  suspended: "warning",
  banned: "destructive",
  // redirect status
  inactive: "secondary",
};

/** Audit log actions are namespaced (`user.update`, `page.delete`, …). */
const AUDIT_ACTION_VARIANTS: Record<string, BadgeVariant> = {
  create: "success",
  update: "outline",
  delete: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>{status}</Badge>;
}

export function AuditActionBadge({ action }: { action: string }) {
  const verb = action.split(".").pop() ?? "";
  return (
    <Badge variant={AUDIT_ACTION_VARIANTS[verb] ?? "secondary"} className="font-mono text-[11px]">
      {action}
    </Badge>
  );
}
