"use client";

import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", supervisoryOnly: true },
  { href: "/cases", label: "My Cases", icon: "📁", supervisoryOnly: false },
  { href: "/all-cases", label: "All Cases", icon: "📋", supervisoryOnly: true },
  { href: "/cases/new", label: "New Case", icon: "➕", supervisoryOnly: false },
];

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const visibleItems = navItems.filter(
    (item) => !item.supervisoryOnly || user.isSupervisory
  );

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-60 bg-white border-r border-gray-200 flex flex-col z-40">
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-navy text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">Logged in as</div>
        <div className="text-sm font-medium text-gray-800 truncate">
          {user.fullName}
        </div>
        <div className="text-xs text-gray-400">{user.username}</div>
      </div>
    </aside>
  );
}
