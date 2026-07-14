import Link from "next/link";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@frontend/components/Logo";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] dark:bg-neutral-950">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-5 py-12">
        <div className="max-w-4xl">
          <Logo height={132} className="mb-8" />
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand">NIT Kurukshetra</p>
          <h1 className="text-4xl font-bold tracking-normal text-ink dark:text-white md:text-6xl">MAD Club Management Portal</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-600 dark:text-neutral-300">
            A full-stack operations dashboard for team heads, secretaries, and club members to manage tasks, EP outreach,
            sponsorships, design work, performance, and reports.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login/member" className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 font-semibold text-white">
              Member Portal <Users size={18} />
            </Link>
            <Link href="/login/admin" className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-5 py-3 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
              Secretary/Admin <ShieldCheck size={18} />
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 px-5 py-3 font-semibold text-brand">
              Register <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
