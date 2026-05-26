"use client";

import { useState } from "react";
import { Button, Input } from "@repo/ui";

interface SettingsFormProps {
  settings: Record<string, unknown>;
}

const FIELDS = [
  { key: "site_name", label: "Site Name", type: "text", placeholder: "My Blog" },
  { key: "site_description", label: "Site Description", type: "text", placeholder: "A great blog about..." },
  { key: "logo_url", label: "Logo URL", type: "url", placeholder: "https://..." },
  { key: "footer_text", label: "Footer Text", type: "text", placeholder: "© 2026 My Blog" },
];

export function SettingsForm({ settings }: SettingsFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key] ?? "")]))
  );
  const [allowComments, setAllowComments] = useState(String(settings.allow_comments) !== "false");
  const [allowRegistration, setAllowRegistration] = useState(String(settings.allow_registration) !== "false");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/v1/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, allow_comments: allowComments, allow_registration: allowRegistration }),
      credentials: "include",
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="text-sm font-medium">{field.label}</label>
          <Input
            type={field.type}
            value={values[field.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
          />
        </div>
      ))}

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} className="rounded" />
          Allow comments
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={allowRegistration} onChange={(e) => setAllowRegistration(e.target.checked)} className="rounded" />
          Allow registration
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </form>
  );
}
