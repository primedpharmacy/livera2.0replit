"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronsUpDown, UserCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DEMO_PERSONA_IDS,
  USERS_REGISTRY,
  type DemoPersonaId,
} from "@/lib/api/constants";
import { useCurrentUserContext } from "@/lib/current-user-context";

/**
 * Task-181 — Demo persona switcher.
 *
 * Renders a small "Signed in as <name> (<role>)" pill at the bottom of the
 * sidebar with a dropdown listing the five seeded personas. Picking one
 * navigates the *current* URL with `?as=<uid>` appended, which the
 * middleware (see `middleware.ts`) translates into a fresh signed session
 * cookie + the `livera_demo_uid` mirror cookie before 307-redirecting to
 * the clean URL.
 *
 * Uses a plain anchor (full page load) rather than a Next.js Link so the
 * server re-reads the `livera_demo_uid` cookie and re-seeds
 * `CurrentUserProvider` with the new persona; the pill itself reads from
 * that provider via `useCurrentUserContext()` so the active persona is
 * reflected on the first paint of every tab (Task-270).
 *
 * Gated on `NODE_ENV !== 'production'` so it never ships to real tenants.
 */
export function PersonaSwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // Task-270 — read the active persona from the request-scoped current-user
  // context (seeded server-side from the `livera_demo_uid` cookie in the
  // workspace layout) rather than the module-level `CURRENT_USER` default,
  // so the pill reflects the remembered persona on the first render of any
  // tab — including brand-new tabs opened from a deep link.
  const { user: currentUser } = useCurrentUserContext();

  if (process.env.NODE_ENV === "production") return null;

  const currentId = currentUser.id;
  const currentName = currentUser.full_name;
  const currentRole = currentUser.roles[0] ?? "User";

  function hrefFor(uid: DemoPersonaId): string {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("as", uid);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="mt-4 pt-3 border-t border-bdr">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Switch demo persona"
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-[12px] text-t2 hover:bg-brand-light hover:text-t1 transition-colors"
          >
            <UserCircle2 className="w-4 h-4 shrink-0 text-t2" aria-hidden />
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block text-[10px] uppercase tracking-wider text-t3 font-bold">
                Signed in as
              </span>
              <span className="block truncate font-medium text-t1">
                {currentName}{" "}
                <span className="text-t3 font-normal">({currentRole})</span>
              </span>
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-t3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-t3">
            Demo personas
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DEMO_PERSONA_IDS.map((uid) => {
            const u = USERS_REGISTRY[uid];
            if (!u) return null;
            const active = uid === currentId;
            return (
              <DropdownMenuItem key={uid} asChild>
                <a
                  href={hrefFor(uid)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    active && "bg-brand-light text-brand"
                  )}
                >
                  <Check
                    className={cn(
                      "w-3.5 h-3.5",
                      active ? "opacity-100 text-brand" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[13px] font-medium">
                      {u.full_name}
                    </span>
                    <span className="block text-[11px] text-t3">
                      {u.roles[0] ?? "User"}
                    </span>
                  </span>
                </a>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
