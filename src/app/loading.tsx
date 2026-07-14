export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-brand" />
        Loading...
      </div>
    </main>
  );
}
