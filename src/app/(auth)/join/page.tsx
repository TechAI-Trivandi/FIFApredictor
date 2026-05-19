"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function JoinPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
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

        <div className="mb-6">
          <div className="mono text-[10px] font-bold uppercase tracking-[0.22em] text-blue-bright mb-2.5">
            Check your email
          </div>
          <h1 className="serif font-semibold text-[36px] leading-[0.92] tracking-[-0.04em] text-paper">
            Almost<br />
            <i className="font-normal text-blue-bright">there.</i>
          </h1>
        </div>

        <p className="text-paper/70 text-sm leading-relaxed mb-6">
          We sent a confirmation link to <strong className="text-paper">{email}</strong>. Click it to activate your account, then sign in.
        </p>

        <Link
          href="/login"
          className="block w-full h-11 bg-blue-brand text-white font-bold uppercase tracking-[0.16em] text-[12px] hover:bg-blue-bright transition-colors text-center leading-[44px]"
        >
          Go to Sign In
        </Link>
      </div>
    );
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
          Join the pool
        </div>
        <h1 className="serif font-semibold text-[44px] leading-[0.92] tracking-[-0.04em] text-paper">
          Create your<br />
          <i className="font-normal text-blue-bright">account.</i>
        </h1>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
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
          <label htmlFor="email" className="block mono text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          {loading ? "Creating account…" : "Join the Pool"}
        </button>
      </form>

      <div className="mt-5 text-center">
        <span className="text-paper/40 text-[12px]">Already have an account? </span>
        <Link href="/login" className="text-blue-bright text-[12px] font-medium hover:underline">
          Sign in
        </Link>
      </div>

      <div className="mt-6 mono text-[10px] uppercase tracking-[0.16em] text-paper/40 text-center">
        Trivandi · World Cup 2026 Pool
      </div>
    </div>
  );
}
