import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthForm } from "@frontend/components/AuthForm";

export default function MemberLogin() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 flex items-center">
      <div className="w-full px-5 py-10">
        <div className="mx-auto max-w-2xl grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-ink dark:text-white">Member Portal</h1>
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                Access your MAD Club dashboard to manage tasks, track progress, and collaborate with team members.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white font-bold">1</div>
                </div>
                <div>
                  <h3 className="font-semibold">Create Account</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Use your @nitkkr.ac.in email to register</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white font-bold">2</div>
                </div>
                <div>
                  <h3 className="font-semibold">Sign In</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Log in with your credentials and year</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white font-bold">3</div>
                </div>
                <div>
                  <h3 className="font-semibold">Access Dashboard</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">View tasks, reports, and collaborate</p>
                </div>
              </div>
            </div>

            <Link 
              href="/register" 
              className="inline-flex items-center gap-2 text-brand font-semibold hover:underline"
            >
              New to the portal? Register here <ArrowRight size={16} />
            </Link>
          </div>

          <div>
            <AuthForm portal="member" />
            <p className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
              Secretary? <Link href="/login/admin" className="font-semibold text-brand hover:underline">Admin login</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
