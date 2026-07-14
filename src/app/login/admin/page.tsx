import Link from "next/link";
import { Shield, Users, BarChart3 } from "lucide-react";
import { AuthForm } from "@frontend/components/AuthForm";
import { Logo } from "@frontend/components/Logo";

export default function AdminLogin() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 flex items-center">
      <div className="w-full px-5 py-10">
        <div className="mx-auto max-w-2xl grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <div>
              <Link href="/" aria-label="MAD Club home">
                <Logo height={76} className="mb-5" />
              </Link>
              <h1 className="text-3xl font-bold text-ink dark:text-white flex items-center gap-2">
                <Shield size={32} className="text-brand" />
                Secretary Portal
              </h1>
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                Authorized secretaries and admins can manage members, oversee all projects, and access detailed reports.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-lg bg-white dark:bg-neutral-800">
                <Users size={24} className="text-brand flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Member Management</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">View, create, and manage club members</p>
                </div>
              </div>

              <div className="flex gap-3 p-4 rounded-lg bg-white dark:bg-neutral-800">
                <BarChart3 size={24} className="text-brand flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Analytics & Reports</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">View comprehensive dashboards and export data</p>
                </div>
              </div>

              <div className="flex gap-3 p-4 rounded-lg bg-white dark:bg-neutral-800">
                <Shield size={24} className="text-brand flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold">Full Control</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Oversee all tasks, events, and sponsorships</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Only authorized secretaries from the AUTHORIZED_SECRETARIES list can access this portal.
              </p>
            </div>
          </div>

          <div>
            <AuthForm portal="admin" />
            <p className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
              Member? <Link href="/login/member" className="font-semibold text-brand hover:underline">Back to member login</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
