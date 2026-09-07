import Link from "next/link";
import { signOut } from "@/auth";
import type { Role } from "@learning-platform/core/db/schema";
import { Icon } from "./icons";
import ThemeToggle from "./ThemeToggle";

const ADMIN_ROLES: readonly Role[] = ["super_admin", "center_admin"];

async function logoutAction(): Promise<void> {
  "use server";
  await signOut({ redirectTo: "/login" });
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "مدیر کل",
  center_admin: "مدیر مرکز",
  teacher: "استاد",
  student: "دانش‌آموز",
};

/**
 * Shared app shell: RTL sidebar navigation + content area.
 * Server component — receives the signed-in user's role to decide which
 * nav items are visible (admin management surfaces).
 */
export default function AppShell({
  user,
  children,
}: {
  user: { name: string; role: Role };
  children: React.ReactNode;
}): JSX.Element {
  const isAdmin = ADMIN_ROLES.includes(user.role);

  const navItems = [
    { href: "/dashboard", label: "داشبورد", icon: <Icon.Home className="h-5 w-5" /> },
    { href: "/courses", label: "محتوای تربیتی", icon: <Icon.BookOpen className="h-5 w-5" /> },
  ];

  const adminItems = [
    { href: "/admin/courses", label: "مدیریت دوره‌ها", icon: <Icon.Cog className="h-5 w-5" /> },
  ];

  return (
    <div dir="rtl" lang="fa" className="min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* ── Sidebar (desktop) ─────────────────────────────────────── */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-5 dark:border-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-sm">
            <Icon.Mosque className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">
              رویش
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">سامانه فرهنگی، تربیتی حوزه و خانواده</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            منوی اصلی
          </div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 dark:text-gray-300 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
            >
              <span className="text-gray-400 transition-colors group-hover:text-emerald-600 dark:text-gray-500 dark:group-hover:text-emerald-400">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}

          {isAdmin ? (
            <>
              <div className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                مدیریت
              </div>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 dark:text-gray-300 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
                >
                  <span className="text-gray-400 transition-colors group-hover:text-emerald-600 dark:text-gray-500 dark:group-hover:text-emerald-400">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>

        {/* User + logout */}
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400">
              {user.name.slice(0, 1) || "؟"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {user.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {ROLE_LABEL[user.role] ?? user.role}
              </div>
            </div>
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                title="خروج"
                className="flex h-9 w-9 items-center justify-center rounded-lg p-0 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <Icon.Logout className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
            <Icon.Mosque className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">رویش</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <span className="text-xs text-gray-500 dark:text-gray-400">{user.name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              title="خروج"
              className="flex h-8 w-8 items-center justify-center rounded-lg p-0 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              <Icon.Logout className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile horizontal nav */}
      <nav className="sticky top-[57px] z-20 flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900 lg:hidden">
        {[...navItems, ...(isAdmin ? adminItems : [])].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 dark:text-gray-300 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
          >
            <span className="text-gray-400 dark:text-gray-500">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="lg:pr-64">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
