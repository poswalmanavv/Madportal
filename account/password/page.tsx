"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: formData.get("currentPassword"),
        newPassword
      })
    });

    setLoading(false);

    if (response.ok) {
      setIsSuccess(true);
      setMessage("✓ Password updated successfully! Redirecting to dashboard...");
      setTimeout(() => router.push("/dashboard"), 2000);
    } else {
      const error = await response.json().catch(() => ({}));
      const fieldError =
        error?.error?.fieldErrors?.newPassword?.[0] ?? error?.error?.fieldErrors?.currentPassword?.[0];
      setMessage(
        typeof error.error === "string"
          ? error.error
          : fieldError ?? "Could not update password. Please try again."
      );
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand/5 to-transparent px-5 py-10">
      <div className="mx-auto w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-8 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-brand dark:text-neutral-400"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Change Password</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Enter your current password and choose a new one (minimum 8 characters).
          </p>
        </div>

        <form action={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Current Password</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Your current password"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">New Password</label>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Min 8 characters"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm New Password</label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
            />
          </div>

          {message && (
            <div
              className={`flex items-center gap-2 rounded-md px-4 py-3 ${
                isSuccess
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {isSuccess ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm">{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}