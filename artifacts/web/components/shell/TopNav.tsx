"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useCurrentClinic } from "@/lib/context";
import type { ClinicId } from "@/lib/api/mock";

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
            <strong className="text-white font-semibold">{clinic.trading_name}</strong>
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
        <span className="text-white/60">Signed in as</span>
        <span className="bg-white/10 text-white font-semibold rounded-full px-2.5 py-0.5 text-[11px] tracking-wide">
          {user.full_name} · {user.roles[0]}
        </span>
      </div>
    </header>
  );
}
