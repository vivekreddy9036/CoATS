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
          <img
            src="/coats_icon_header.png"
            alt="CoATS"
            className="h-9 w-auto object-contain"
          />
          <img
            src="/coats_header_beside.png"
            alt=""
            className="h-7 w-auto object-contain hidden sm:block"
          />
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end text-sm">
              <span className="font-medium">{user.fullName}</span>
              <span className="text-xs text-gray-300">
                {user.isSupervisory ? "Supervisory Officer" : "Case Holding Officer"} — {user.branchCode}
              </span>
              {user.lastLoginLocation && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.003 3.5-4.697 3.5-8.327a8.25 8.25 0 00-16.5 0c0 3.63 1.556 6.324 3.5 8.327a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  {user.lastLoginLocation}
                </span>
              )}
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
