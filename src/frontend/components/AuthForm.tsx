"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { YEARS } from "@shared/constants";
import { PasswordInput } from "@frontend/components/PasswordInput";

export function AuthForm({ portal }: { portal: "member" | "admin" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [savedEmail, setSavedEmail] = useState("");
  const [savedYear, setSavedYear] = useState("4th Year");

  useEffect(() => {
    const saved = localStorage.getItem(`login_${portal}`);
    if (saved) {
      const { email, year } = JSON.parse(saved);
      setSavedEmail(email);
      setSavedYear(year);
      setRememberMe(true);
    }
  }, [portal]);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    
    const email = String(formData.get("email"));
    const year = String(formData.get("year") ?? "4th Year");
    
    const result = await signIn("credentials", {
      email,
      password: formData.get("password"),
      year,
      portal,
      rememberMe: rememberMe.toString(),
      redirect: false
    });
    
    if (result?.error) {
      setError("Invalid credentials or unauthorized portal access.");
    } else {
      if (rememberMe) {
        localStorage.setItem(`login_${portal}`, JSON.stringify({ email, year }));
      } else {
        localStorage.removeItem(`login_${portal}`);
      }
      router.push("/dashboard");
    }
    
    setLoading(false);
  }

  return (
    <form action={onSubmit} className="w-full max-w-md space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <h1 className="text-2xl font-bold">{portal === "admin" ? "Secretary/Admin Portal" : "Member Portal"}</h1>
        <p className="mt-1 text-sm text-neutral-500">Use your @nitkkr.ac.in email.</p>
      </div>
      <input 
        name="email" 
        type="email" 
        required 
        placeholder="Email" 
        defaultValue={savedEmail}
        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-3 dark:border-neutral-700" 
      />
      <PasswordInput
        name="password"
        required
        placeholder="Password"
        autoComplete="current-password"
        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-3 dark:border-neutral-700"
      />
      {portal === "member" && (
        <select 
          name="year" 
          required 
          defaultValue={savedYear}
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-3 dark:border-neutral-700"
        >
          {YEARS.map((year) => (
            <option key={year}>{year}</option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 cursor-pointer hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
        <input 
          type="checkbox" 
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
        <span className="text-sm font-medium">Save login info</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button 
        disabled={loading} 
        className="w-full rounded-md bg-brand px-4 py-3 font-semibold text-white disabled:opacity-60 hover:opacity-90 transition"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
