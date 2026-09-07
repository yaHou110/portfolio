import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { catalog, learning } from "@learning-platform/core/api";
import AppShell from "@/components/AppShell";
import type { Role } from "@learning-platform/core/db/schema";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: readonly Role[] = ["super_admin", "center_admin"];

/**
 * Home — entry point after login. Students get a quick view of their
 * enrollments; admins get tenant-level counts.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { tenantId, id: userId, role } = session.user;
  const isAdmin = ADMIN_ROLES.includes(role);

  let enrollmentCount = 0;
  let completedCount = 0;
  let courseCount = 0;
  try {
    if (isAdmin) {
      courseCount = (await catalog.listCourses(tenantId, { includeNonPublished: true })).length;
      const all = await learning.listEnrollments(tenantId);
      enrollmentCount = all.length;
      completedCount = all.filter((e) => e.status === "completed").length;
    } else {
      const mine = await learning.listEnrollments(tenantId, { userId });
      enrollmentCount = mine.length;
      completedCount = mine.filter((e) => e.status === "completed").length;
    }
  } catch {
    // DB unreachable in a degraded deploy — render nav only rather than crash.
  }

  return (
    <AppShell user={{ name: session.user.name, role }}>
      <h1 className="mb-1 text-2xl font-bold">خوش آمدید، {session.user.name}</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
        {isAdmin
          ? "پنل مدیریت مرکز شما — آمار کلی و دسترسی سریع."
          : "به فضای یادگیری خود خوش آمدید."}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/courses"
          className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 shadow-sm transition hover:border-emerald-300"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">دوره‌های در دسترس</div>
          <div className="mt-1 text-3xl font-bold text-emerald-800">
            {courseCount || "—"}
          </div>
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">مشاهده کاتالوگ دوره‌ها</div>
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 shadow-sm transition hover:border-emerald-300"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">ثبت‌نام‌های من</div>
          <div className="mt-1 text-3xl font-bold text-emerald-800">{enrollmentCount}</div>
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {completedCount} دوره تکمیل‌شده
          </div>
        </Link>
        <Link
          href={isAdmin ? "/admin/courses" : "/dashboard"}
          className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 shadow-sm transition hover:border-emerald-300"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {isAdmin ? "مدیریت محتوا" : "پیشرفت من"}
          </div>
          <div className="mt-1 text-3xl font-bold text-emerald-800">
            {isAdmin ? "ورود" : "ورود"}
          </div>
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {isAdmin ? "ایجاد و انتشار دوره‌ها" : "جزئیات پیشرفت یادگیری"}
          </div>
        </Link>
      </div>
    </AppShell>
  );
}
