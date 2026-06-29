"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";
import Spinner from "@/components/ui/Spinner";

interface AuthState {
  status: "checking" | "authenticated" | "needs_consent" | "error";
  email?: string | null;
  error?: string;
}

/**
 * AuthGate — client component that gates the app behind Google Drive consent.
 *
 * Flow:
 *  1. On mount, call GET /api/auth/status to see whether the user has granted
 *     Drive access. While that resolves, show a centered spinner.
 *  2. If `needs_consent` is true, redirect to /api/auth/login (silent OAuth
 *     with prompt=none) so the user is bounced through Google and back.
 *  3. If an `auth_error` query param is present (set by the OAuth callback on a
 *     hard failure), surface the error inline with a retry button instead of
 *     looping.
 *  4. Once `authenticated`, render children.
 *
 * CF Access already authenticated the user at the edge; this gate only handles
 * the Google Drive consent layer on top.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("auth_error");

  // If the OAuth callback already flagged an auth error, surface it as the
  // initial state instead of re-entering the consent loop. Computing this in
  // the useState initializer (rather than synchronously inside an effect)
  // avoids a cascading render and satisfies react-hooks/set-state-in-effect.
  const [state, setState] = useState<AuthState>(() =>
    authError
      ? { status: "error", error: decodeAuthError(authError) }
      : { status: "checking" },
  );

  useEffect(() => {
    // When an auth error is already shown, skip the network check entirely.
    if (authError) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setState({
            status: "error",
            error: `Unable to verify your session (HTTP ${res.status}).`,
          });
          return;
        }
        const data: { authenticated: boolean; email: string | null; needs_consent: boolean } =
          await res.json();
        if (cancelled) return;

        if (data.authenticated) {
          setState({ status: "authenticated", email: data.email });
          return;
        }

        if (data.needs_consent) {
          setState({ status: "needs_consent", email: data.email });
          // Kick off the silent OAuth flow. The login route redirects to Google
          // with prompt=none; the callback either sets cookies and sends the
          // user back here, or returns with ?auth_error=… on a hard failure.
          window.location.href = "/api/auth/login";
          return;
        }

        // No CF email at all (shouldn't happen behind CF Access, but be safe).
        setState({
          status: "error",
          error: "Your session could not be identified. Please reload the page.",
        });
      } catch {
        if (cancelled) return;
        setState({
          status: "error",
          error: "Network error while checking your session. Please try again.",
        });
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [authError]);

  /* ---- Loading / redirecting ---- */
  if (state.status === "checking" || state.status === "needs_consent") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-gray-500">
          {state.status === "needs_consent"
            ? "Connecting to Google Drive…"
            : "Checking your session…"}
        </p>
      </div>
    );
  }

  /* ---- Error ---- */
  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
            <svg
              className="h-6 w-6 text-rose-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M12 9v4m0 4h.01M10.29 3.86l-8.14 14a2 2 0 001.71 3h16.28a2 2 0 001.71-3l-8.14-14a2 2 0 00-3.42 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Authentication required
          </h1>
          <p className={cn("mt-2 text-sm text-gray-500")}>{state.error}</p>
          <button
            type="button"
            onClick={() => {
              // Clear the auth_error param and retry the consent flow.
              router.replace("/");
              // Hard reload to retrigger the effect after the param is gone.
              setTimeout(() => window.location.reload(), 50);
            }}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ---- Authenticated ---- */
  return <>{children}</>;
}

/** Map the short error codes from the OAuth callback to a human message. */
function decodeAuthError(code: string): string {
  switch (code) {
    case "no_code":
      return "Google did not return an authorization code. Please try again.";
    case "token_exchange":
      return "We couldn't complete the sign-in with Google. Please try again.";
    case "no_refresh_token":
      return "Google didn't grant a refresh token. You may need to revoke access in your Google account and try again.";
    case "consent_required":
      return "Google Drive access needs your explicit consent. Click try again to approve.";
    default:
      return decodeURIComponent(code);
  }
}
