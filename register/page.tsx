"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEPARTMENTS, TEAM_HEAD_ROLES, YEARS } from "@/lib/constants";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    const departments = Array.from(selectedDepts);

    if (departments.length === 0) {
      setMessage("Please select at least one department.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        year: formData.get("year"),
        teamHeadRole: formData.get("teamHeadRole"),
        departments
      })
    });

    setLoading(false);

    if (response.ok) {
      setIsSuccess(true);
      setMessage("✓ Account created successfully! Redirecting to login...");
      setTimeout(() => router.push("/login/member"), 2000);
    } else {
      const error = await response.json();
      setMessage(error.error || "Registration failed. Please try again.");
    }
  }

  function toggleDept(dept: string) {
    const newSet = new Set(selectedDepts);
    if (newSet.has(dept)) {
      newSet.delete(dept);
    } else {
      newSet.add(dept);
    }
    setSelectedDepts(newSet);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand/5 to-transparent px-5 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-lg border border-neutral-200 bg-white p-8 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Register as MAD Club Member</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Create your account to access the club management portal. Use your @nitkkr.ac.in email.
          </p>
        </div>

        <form action={onSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Full Name</label>
              <input
                name="name"
                required
                placeholder="Your full name"
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email (@nitkkr.ac.in)</label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@nitkkr.ac.in"
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                name="password"
                type="password"
                required
                placeholder="Min 8 characters"
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Year</label>
              <select
                name="year"
                required
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
              >
                {YEARS.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Team Head Role (Optional)</label>
            <select
              name="teamHeadRole"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
            >
              {TEAM_HEAD_ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium">Select Departments</label>
            <div className="grid gap-2 md:grid-cols-2">
              {DEPARTMENTS.map((department) => (
                <button
                  key={department}
                  type="button"
                  onClick={() => toggleDept(department)}
                  className={`rounded-md border-2 px-3 py-2 text-left text-sm font-medium transition ${
                    selectedDepts.has(department)
                      ? "border-brand bg-brand/10 text-brand dark:bg-brand/20"
                      : "border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDepts.has(department)}
                    onChange={() => toggleDept(department)}
                    className="mr-2"
                    readOnly
                  />
                  {department}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <div
              className={`rounded-md px-4 py-3 flex items-center gap-2 ${
                isSuccess
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {isSuccess ? (
                <CheckCircle size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span className="text-sm">{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand px-5 py-3 font-semibold text-white disabled:opacity-60 hover:opacity-90 transition"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
            Already have an account?{" "}
            <Link href="/login/member" className="font-semibold text-brand hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
