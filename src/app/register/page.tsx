"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEPARTMENTS, REGISTRABLE_YEARS, SELECTABLE_TEAM_HEAD_ROLES, TEAM_HEAD_YEAR } from "@shared/constants";
import { AlertCircle, CheckCircle, ShieldCheck } from "lucide-react";
import { Logo } from "@frontend/components/Logo";
import { PasswordInput } from "@frontend/components/PasswordInput";

export default function RegisterPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  // Default to the first registrable year, not YEARS[0] -- that was "1st Year", which the
  // form no longer offers. Leaving the default at a hidden value would submit it invisibly.
  const [year, setYear] = useState<string>(REGISTRABLE_YEARS[0]);

  // Only 4th years hold team head roles, so the card is shown to them alone -- and when it
  // is shown, it is mandatory. The server enforces both halves of this rule independently
  // (see registerSchema); hiding the field is presentation, not a security control.
  const isFinalYear = year === TEAM_HEAD_YEAR;

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

    const teamHeadRole = formData.get("teamHeadRole");
    if (isFinalYear && !teamHeadRole) {
      setMessage("Select your team head role.");
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
        // Omitted entirely for non-final years: the server rejects the field outright from
        // anyone who is not a 4th year.
        ...(isFinalYear ? { teamHeadRole } : {}),
        departments
      })
    });

    setLoading(false);

    if (response.ok) {
      setIsSuccess(true);
      setMessage("✓ Account created successfully! Redirecting to login...");
      setTimeout(() => router.push("/login/member"), 2000);
    } else {
      const body = await response.json().catch(() => null);
      setMessage(readError(body));
    }
  }

  // A validation failure returns Zod's flattened shape ({ fieldErrors, formErrors }), not a
  // string. Rendering that object directly showed the user nothing useful -- pull the actual
  // message out, e.g. "Only an authorized secretary can select the Secretary role".
  function readError(body: any): string {
    const error = body?.error;
    if (typeof error === "string") return error;

    const fieldErrors = error?.fieldErrors as Record<string, string[]> | undefined;
    const firstField = fieldErrors && Object.values(fieldErrors).flat().filter(Boolean)[0];
    if (firstField) return firstField;

    const formError = error?.formErrors?.[0];
    if (formError) return formError;

    return "Registration failed. Please check your details and try again.";
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
          <Link href="/" aria-label="MAD Club home">
            <Logo height={76} className="mb-5" />
          </Link>
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
              <PasswordInput
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min 8 characters"
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Year</label>
              <select
                name="year"
                required
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-700"
              >
                {REGISTRABLE_YEARS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Shown to 4th years only, and mandatory when shown. */}
          {isFinalYear && (
            <div className="rounded-lg border-2 border-brand/40 bg-brand/5 p-4 dark:bg-brand/10">
              <div className="mb-3 flex items-start gap-2">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" />
                <div>
                  <h2 className="text-sm font-semibold text-brand">Team Head Role — required for 4th years</h2>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    As a final-year member you lead a team. Your selection grants you team lead access to
                    tasks, sponsorships and EP records as soon as your account is created.
                  </p>
                </div>
              </div>
              <label className="mb-1 block text-sm font-medium">
                Select your team head role <span className="text-red-600">*</span>
              </label>
              <select
                name="teamHeadRole"
                required
                defaultValue=""
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="" disabled>
                  Choose a role...
                </option>
                {SELECTABLE_TEAM_HEAD_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          )}

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
