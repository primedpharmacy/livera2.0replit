"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Keyboard } from "lucide-react";
import { openKeyboardShortcuts } from "@/components/shell/KeyboardShortcutsHelp";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useCurrentClinic } from "@/lib/context";
import { useCurrentUserContext } from "@/lib/current-user-context";
import type { ClinicId } from "@/lib/api/mock";

const IS_DEV = process.env.NODE_ENV !== "production";

const WORKSPACES: { id: ClinicId; label: string }[] = [
  { id: "vsc", label: "VSC" },
  { id: "feeltru", label: "FeelTru" },
];

export function TopNav() {
  const router = useRouter();
  const user = useCurrentUser();
  const clinic = useCurrentClinic();

  function handleSwitch(id: ClinicId) {
    router.push(`/${id}/dashboard`);
  }

  return (
    <header className="h-9 bg-nav flex items-center px-4 gap-3 shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-[10px] font-extrabold">
          L
        </span>
        <span className="text-white font-semibold text-sm tracking-tight">Livera</span>
      </div>

      <div className="w-px h-[18px] bg-white/20" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 text-white/85 text-xs font-medium hover:bg-white/[0.08] rounded px-2 py-1 -mx-2 transition-colors outline-none">
            <span className="text-white/60">Workspace:</span>
            <strong className="text-white font-semibold">{clinic.config.clinic_name}</strong>
            <ChevronDown className="w-3 h-3 opacity-55 ml-0.5" aria-hidden={true} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 mt-1">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-t3 font-bold">
            Switch workspace
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {WORKSPACES.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() => handleSwitch(ws.id)}
              className={ws.id === clinic.id ? "font-semibold text-brand" : ""}
            >
              {ws.label}
              {ws.id === clinic.id && (
                <span className="ml-auto text-[10px] text-t3">current</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={openKeyboardShortcuts}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
          className="flex items-center justify-center w-6 h-6 rounded text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors outline-none"
        >
          <Keyboard className="w-3.5 h-3.5" aria-hidden={true} />
        </button>
        {IS_DEV ? (
          <DemoUserSwitcher />
        ) : (
          <>
            <span className="text-white/60">Signed in as</span>
            <span className="bg-white/10 text-white font-semibold rounded-full px-2.5 py-0.5 text-[11px] tracking-wide">
              {user.full_name} · {user.roles[0]}
            </span>
          </>
        )}
      </div>
    </header>
  );
}

function DemoUserSwitcher() {
  const { user, setUserId, availableUsers } = useCurrentUserContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Switch demo user (dev only)"
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/[0.18] text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors outline-none"
        >
          <span className="text-white/60 font-normal">Demo:</span>
          <span>
            {user.full_name} · {user.roles[0]}
            {user.can_refund ? "" : " · 🔒"}
          </span>
          <ChevronDown className="w-3 h-3 opacity-70" aria-hidden={true} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 mt-1">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-t3 font-bold">
          Switch demo user
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableUsers.map((u) => {
          const active = u.id === user.id;
          return (
            <DropdownMenuItem
              key={u.id}
              onSelect={() => setUserId(u.id)}
              className={active ? "font-semibold text-brand" : ""}
            >
              <div className="flex flex-col">
                <span>
                  {u.full_name} · {u.roles[0]}
                </span>
                <span className="text-[10px] text-t3">
                  {u.can_refund ? "can refund" : "no refund authority"}
                </span>
              </div>
              {active && (
                <span className="ml-auto text-[10px] text-t3">current</span>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[10px] text-t3 leading-snug">
          Dev-only control. Hidden in production builds.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
