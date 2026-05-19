"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, LeaderboardEntry } from "@/lib/types";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/predictions", label: "Predictions", showLiveDot: true },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/matches", label: "Matches" },
];

export function NavBar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [me, setMe] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("leaderboard")
      .select("*")
      .eq("user_id", profile.id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setMe(data as LeaderboardEntry);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.id, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = profile.display_name?.charAt(0).toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-50 bg-paper">
      <div className="max-w-[1280px] mx-auto px-7 pt-5 pb-5 flex items-center justify-between border-b border-line">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-4 group">
          <div className="h-11 w-auto flex items-center">
            <Image
              src="/logo-26.png"
              alt="FIFA World Cup 2026"
              width={44}
              height={44}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>
          <div className="flex flex-col leading-[1.15] pt-px">
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink">
              Football Predictor
            </span>
            <span className="serif italic text-[13px] text-muted-warm mt-0.5">
              Trivandi · Office Pool
            </span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${
                  isActive
                    ? "text-ink"
                    : "text-muted-warm hover:text-ink"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.showLiveDot && (
                    <span className="inline-block w-[5px] h-[5px] rounded-full bg-blue-brand pulse-dot align-middle" />
                  )}
                </span>
                {isActive && (
                  <span className="absolute left-5 right-5 bottom-0 h-[2px] bg-ink" />
                )}
              </Link>
            );
          })}
          {profile.role === "admin" && (
            <Link
              href="/admin"
              className={`relative px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${
                pathname.startsWith("/admin")
                  ? "text-ink"
                  : "text-muted-warm hover:text-ink"
              }`}
            >
              Admin
              {pathname.startsWith("/admin") && (
                <span className="absolute left-5 right-5 -bottom-[21px] h-[2px] bg-ink" />
              )}
            </Link>
          )}
        </nav>

        {/* User chip */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted-warm">
              {me?.rank ? `You · #${me.rank}` : "You"}
            </span>
            {me ? (
              <span className="serif italic font-semibold text-[16px] text-ink leading-tight tracking-[-0.02em]">
                {me.total_points} pts
              </span>
            ) : (
              <span className="serif italic text-[14px] text-muted-warm leading-tight">
                {profile.display_name}
              </span>
            )}
          </div>
          {profile.avatar_url ? (
            <div className="w-[30px] h-[30px] rounded-full overflow-hidden border border-ink">
              <Image
                src={profile.avatar_url}
                alt={profile.display_name}
                width={30}
                height={30}
                className="object-cover w-full h-full"
              />
            </div>
          ) : (
            <div className="w-[30px] h-[30px] rounded-full bg-ink text-paper grid place-items-center font-bold text-[13px]">
              {initial}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-muted-warm hover:text-ink transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex gap-1 px-4 py-2 overflow-x-auto border-b border-line bg-paper">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap ${
                isActive ? "text-ink underline underline-offset-4" : "text-muted-warm"
              }`}
            >
              {item.label}
              {item.showLiveDot && (
                <span className="inline-block ml-1 w-[5px] h-[5px] rounded-full bg-blue-brand pulse-dot align-middle" />
              )}
            </Link>
          );
        })}
        {profile.role === "admin" && (
          <Link
            href="/admin"
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap ${
              pathname.startsWith("/admin") ? "text-ink underline underline-offset-4" : "text-muted-warm"
            }`}
          >
            Admin
          </Link>
        )}
      </nav>
    </header>
  );
}
