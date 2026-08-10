import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/groups");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">SplitApp</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Grup harcamalarini kaydet, kimin kime ne kadar borclu oldugunu tek bakista gor.
      </p>
      <div className="flex gap-3">
        <Link
          href="/sign-in"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Giris yap
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Kayit ol
        </Link>
      </div>
    </div>
  );
}
