import { cookies } from "next/headers";
import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "./SettingsForm";

const DEFAULT_SETTINGS = {
  site_name: "",
  site_description: "",
  logo_url: "",
  allow_comments: "true",
  allow_registration: "true",
  footer_text: "",
};

async function fetchSettings(): Promise<Record<string, unknown>> {
  try {
    const cookieStore = await cookies();
    const API_URL = process.env.API_URL ?? "http://localhost:3003";
    const res = await fetch(`${API_URL}/api/v1/admin/settings`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (!res.ok) return DEFAULT_SETTINGS;
    const body = await res.json() as { data: Record<string, unknown> };
    return { ...DEFAULT_SETTINGS, ...body.data };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default async function SettingsPage() {
  const settings = await fetchSettings();

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Site Settings" description="Configure your blog platform" />

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium">General</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Site identity and global behaviour
          </p>
        </div>
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
