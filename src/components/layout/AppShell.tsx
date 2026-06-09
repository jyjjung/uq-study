"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  GraduationCap,
  Home,
  LogOut,
  Play,
  Search,
  Target,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/quizzes", label: "Quizzes", icon: Play },
  { href: "/study-plan", label: "Study", icon: Target },
  { href: "/search", label: "Search", icon: Search },
  { href: "/grade-calculator", label: "Grades", icon: Calculator },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  const isActive = (href: string) => {
    if (href === "/quizzes") {
      return (
        pathname.startsWith("/quizzes") ||
        (pathname.startsWith("/practice") && !pathname.startsWith("/practice/module"))
      );
    }
    if (href === "/study-plan") {
      return (
        pathname.startsWith("/study-plan") ||
        pathname.startsWith("/practice/module")
      );
    }
    return pathname.startsWith(href);
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f5f3f0]">
      <header className="sticky top-0 z-50 border-b border-[#51247a]/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#51247a] text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#51247a]">UQ Study</p>
              <p className="text-xs text-gray-500">Exam prep & revision</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(href)
                    ? "bg-[#51247a] text-white"
                    : "text-gray-600 hover:bg-[#51247a]/10 hover:text-[#51247a]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden text-sm text-gray-600 sm:inline">
                  <User className="mr-1 inline h-4 w-4" />
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d1a5c]"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white md:hidden">
        <div className="flex justify-around py-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                isActive(href)
                  ? "text-[#51247a] font-semibold"
                  : "text-gray-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
