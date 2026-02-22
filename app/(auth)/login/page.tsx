"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      setExiting(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 350);
    }
  }

  return (
    <>
      {exiting && (
        <div className="overlay-fade-in pointer-events-none fixed inset-0 z-50 bg-zinc-950" />
      )}
      <div
        className={["w-full max-w-sm", exiting ? "login-exit" : ""].join(" ")}
      >
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="font-display text-xl tracking-tight text-zinc-100 italic">
              SkyOps
            </h1>
            <p className="mt-0.5 text-xs tracking-widest text-zinc-600 uppercase">
              Charter Operations
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-xs font-semibold text-zinc-400">
            Staff sign in
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-zinc-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@airline.com"
                className="amber-glow w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:border-amber-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium tracking-wide text-zinc-500">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="amber-glow w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:border-amber-400"
              />
            </div>

            {error && (
              <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full justify-center py-2"
            >
              Sign in
            </Button>
          </form>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Demo credentials:
          </p>
          <p className="mt-1.5 font-mono text-xs text-zinc-400">
            Email: admin@example.com
          </p>
          <p className="font-mono text-xs text-zinc-400">Password: password</p>
        </div>
      </div>
    </>
  );
}
