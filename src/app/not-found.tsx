import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-1 text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-neutral-500">That page does not exist or you do not have access to it.</p>
        <Link href="/" className="mt-5 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
          Back to home
        </Link>
      </div>
    </main>
  );
}
