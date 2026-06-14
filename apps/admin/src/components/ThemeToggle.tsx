"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@repo/ui";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme((localStorage.getItem("admin-theme") as Theme) ?? "system");
  }, []);

  // In system mode, follow OS preference changes live.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function select(next: Theme) {
    setTheme(next);
    localStorage.setItem("admin-theme", next);
    applyTheme(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle theme">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => select("light")}>
          <Sun /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => select("dark")}>
          <Moon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => select("system")}>
          <Monitor /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
