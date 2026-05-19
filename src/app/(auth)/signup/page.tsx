"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { display_name: displayName },
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="bg-ink text-paper p-9 sm:p-11 shadow-2xl shadow-black/60 border border-paper/15">
      <div className="flex items-center gap-3 mb-9">
        <div className="relative w-9 h-12">
          <Image
            src="/logo-26.png"
            alt="FIFA World Cup 2026"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="leading-[1.15]">
          <div className="mono text-[11px] font-bold uppercase tracking-[0.24em] text-paper">
            Football Predictor
          </div>
          <div className="serif italic text-[13px] text-paper/60 mt-0.5">
            Trivandi · Office Pool
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="mono text-[10px] font-bold uppercase tracking-[0.22em] text-blue-bright mb-2.5">
          Welcome
        </div>
        <h1 className="serif font-semibold text-[44px] leading-[0.92] tracking-[-0.04em] text-paper">
          Set up your<br />
          <i className="font-normal text-blue-bright">account.</i>
        </h1>
      </div>

      <form onSubmit={handleSetup} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="displayName" className="block mono text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full h-11 bg-transparent border border-paper/25 px-3.5 text-[14px] text-paper placeholder:text-paper/30 focus:outline-none focus:border-blue-bright transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block mono text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full h-11 bg-transparent border border-paper/25 px-3.5 text-[14px] text-paper placeholder:text-paper/30 focus:outline-none focus:border-blue-bright transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block mono text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full h-11 bg-transparent border border-paper/25 px-3.5 text-[14px] text-paper placeholder:text-paper/30 focus:outline-none focus:border-blue-bright transition-colors"
          />
        </div>
        {error && (
          <div className="border border-bad/50 bg-bad/15 px-3 py-2.5 text-sm text-paper">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-blue-brand text-white font-bold uppercase tracking-[0.16em] text-[12px] hover:bg-blue-bright transition-colors disabled:opacity-60"
        >
          {loading ? "Setting up…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
