"use client";

import { useAuth } from "@/components/AuthProvider";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-navy text-white flex items-center justify-between px-6 z-50 shadow-md">
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
    </header>
  );
}
