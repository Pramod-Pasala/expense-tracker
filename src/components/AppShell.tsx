"use client";

import { Suspense, useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";
import Spinner from "@/components/ui/Spinner";

/**
 * AppShell — the authenticated application frame.
 *
 * Waits for AuthGate to confirm the user is authenticated, then renders the
 * Nav (desktop sidebar / mobile bottom bar) and the page content with the
 * correct layout offsets. Once authenticated, it also fetches the user's email
 * from /api/auth/status so the Nav can display it.
 *
 * AuthGate uses `useSearchParams`, which requires a <Suspense> boundary during
 * static rendering — that's why this wrapper exists rather than inlining
 * everything in the (server) root layout.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <AuthGate>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>
      </AuthGate>
    </Suspense>
  );
}

/**
 * The actual layout once authenticated. Kept separate so it can fetch the
 * email for the Nav without re-running AuthGate's logic.
 */
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.email) setEmail(data.email);
      })
      .catch(() => {
        /* non-fatal — Nav just shows "Signed in" */
      });
  }, []);

  return (
    <div className="min-h-screen">
      <Nav email={email} />
      {/* lg:pl-60 clears the fixed sidebar; pb-16 clears the mobile bottom nav. */}
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
