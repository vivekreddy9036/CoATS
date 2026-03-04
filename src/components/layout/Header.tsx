"use client";

import { useAuth } from "@/components/AuthProvider";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 h-16 bg-navy text-white flex items-center gap-2 px-4 shadow-md">
      <SidebarTrigger className="text-white hover:bg-white/20 hover:text-white" />
      <Separator orientation="vertical" className="h-5 bg-white/30" />
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold tracking-wide">CoATS</div>
          <div className="hidden sm:block text-xs text-gray-300 border-l border-gray-500 pl-3">
            Cases of Anti Terrorism Squad
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end text-sm">
              <span className="font-medium">{user.fullName}</span>
              <span className="text-xs text-gray-300">
                {user.isSupervisory ? "Supervisory Officer" : "Case Holding Officer"} — {user.branchCode}
              </span>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
