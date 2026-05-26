import { cookies } from "next/headers";
import { Card, CardContent, CardHeader } from "@repo/ui";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your blog platform</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">General</h2>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
