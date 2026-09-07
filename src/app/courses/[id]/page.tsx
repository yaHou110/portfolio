import Link from "next/link";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { catalog, learning } from "@learning-platform/core/api";
import AppShell from "@/components/AppShell";
import type { Role } from "@learning-platform/core/db/schema";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: readonly Role[] = ["super_admin", "center_admin"];

const STATUS_LABEL: Record<string, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "بایگانی",
};

/**
 * /courses/[id] — course detail: description, enroll action, and the lesson
 * list with per-lesson completion state (when the caller is enrolled).
 */
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { tenantId, id: userId, role } = session.user;
  const isAdmin = ADMIN_ROLES.includes(role);

  const course = await catalog.getCourse(tenantId, id, { includeNonPublished: isAdmin });
  if (!course) notFound();

  const lessons = await catalog.listLessons(tenantId, id, { includeNonPublished: isAdmin });

  // Caller's enrollment (any status) + progress map for the lesson list.
  const myEnrollments = await learning.listEnrollments(tenantId, { userId });
  const enrollment = myEnrollments.find((e) => e.courseId === id) ?? null;
  const progress = enrollment
    ? await learning.listProgress(tenantId, enrollment.id)
    : [];
  const progressByLesson = new Map(progress.map((p) => [p.lessonId, p.status]));
  const completedCount = lessons.filter((l) => progressByLesson.get(l.id) === "completed").length;
  const pct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  async function enrollAction(): Promise<void> {
    "use server";
    const s = await auth();
    if (!s?.user) redirect("/login");
    await learning.enroll(s.user.tenantId, s.user.id, id);
    revalidatePath(`/courses/${id}`);
  }

  return (
    <AppShell user={{ name: session.user.name, role }}>
      <Link href="/courses" className="text-sm text-emerald-700 hover:underline">
        ← بازگشت به دوره‌ها
      </Link>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {isAdmin ? (
              <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                {STATUS_LABEL[course.status] ?? course.status}
              </span>
            ) : null}
          </div>
          {enrollment ? (
            <div className="text-left">
              <span className="inline-block rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                {enrollment.status === "completed"
                  ? "این دوره را تکمیل کرده‌اید 🎉"
                  : "ثبت‌نام شده"}
              </span>
            </div>
          ) : course.status === "published" ? (
            <form action={enrollAction}>
              <button
                type="submit"
                className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800"
              >
                ثبت‌نام در دوره
              </button>
            </form>
          ) : null}
        </div>

        {course.description ? (
          <p className="mt-4 text-sm leading-7 text-gray-700 dark:text-gray-300">{course.description}</p>
        ) : null}

        {enrollment && lessons.length > 0 ? (
          <div className="mt-6">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <span>پیشرفت دوره</span>
              <span>
                {completedCount} از {lessons.length} درس ({pct}٪)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">درس‌ها ({lessons.length})</h2>
      {lessons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {isAdmin
            ? "هنوز درسی به این دوره اضافه نشده — از «مدیریت دوره‌ها» درس اضافه کنید."
            : "درس‌های این دوره به‌زودی اضافه می‌شوند."}
        </div>
      ) : (
        <ol className="space-y-2">
          {lessons.map((lesson) => {
            const done = progressByLesson.get(lesson.id) === "completed";
            return (
              <li key={lesson.id}>
                <Link
                  href={`/courses/${course.id}/lessons/${lesson.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 px-4 py-3 shadow-sm transition hover:border-emerald-300"
                >
                  <span className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        done
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-200 text-gray-600 dark:text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {done ? "✓" : lesson.orderIndex + 1}
                    </span>
                    <span className={done ? "text-gray-400 dark:text-gray-500 line-through" : ""}>
                      {lesson.title}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {done ? "مشاهده شده" : "مشاهده درس"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </AppShell>
  );
}
