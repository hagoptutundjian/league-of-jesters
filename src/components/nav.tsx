"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/auth/config";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";
import Image from "next/image";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/rookie-draft", label: "Rookie Draft" },
  { href: "/free-agent-auction", label: "FA Auction" },
  { href: "/trades", label: "Trades" },
  { href: "/players", label: "Salaries" },
  { href: "/docs", label: "League Docs" },
];

interface NavProps {
  userEmail?: string;
  isCommissioner?: boolean;
  teamSlug?: string;
}

export function Nav({ userEmail, isCommissioner, teamSlug }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/jester-logo.png"
              alt="League of Jesters"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-lg font-bold tracking-tight hidden sm:inline">LOJ</span>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname.startsWith(link.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            {teamSlug && (
              <Link
                href={`/teams/${teamSlug}`}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname === `/teams/${teamSlug}`
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                My Team
              </Link>
            )}
            {isCommissioner && (
              <Link
                href="/admin"
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname.startsWith("/admin")
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {userEmail && (
            <span className="hidden text-sm text-muted-foreground lg:block">
              {userEmail}
            </span>
          )}
          <ThemeToggle />
          {userEmail ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden md:inline-flex">
              Sign Out
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
              <Link href="/login">Sign In</Link>
            </Button>
          )}
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu with animation */}
      <div
        className={`md:hidden border-t bg-card overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="px-4 py-2 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "block rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-accent",
                pathname.startsWith(link.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          {teamSlug && (
            <Link
              href={`/teams/${teamSlug}`}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "block rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-accent",
                pathname === `/teams/${teamSlug}`
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              My Team
            </Link>
          )}
          {isCommissioner && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "block rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-accent",
                pathname.startsWith("/admin")
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              Admin
            </Link>
          )}
          <div className="border-t pt-2 mt-2">
            {userEmail ? (
              <>
                <p className="px-3 py-1 text-sm text-muted-foreground">{userEmail}</p>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent"
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
