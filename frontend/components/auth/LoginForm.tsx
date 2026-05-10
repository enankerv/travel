"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleIcon } from "@/components/icons";
import { getSafeRedirectPath, POST_AUTH_REDIRECT_KEY, replaceBrowserPathStripHash } from "@/lib/safeRedirect";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const urlError = searchParams.get("error");

  const afterAuthPath = useMemo(
    () => getSafeRedirectPath(searchParams.get("redirect")),
    [searchParams]
  );

  // Already signed in? Skip the form and send them straight to ?redirect=...
  // (or the default landing page). ``replace`` so the back button doesn't
  // bounce the user back to a login screen they can't use.
  useEffect(() => {
    if (authLoading || !user) return;
    if (typeof window !== "undefined") sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
    router.replace(afterAuthPath);
  }, [authLoading, user, afterAuthPath, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = searchParams.get("redirect");
    if (raw) {
      const path = getSafeRedirectPath(raw);
      sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, path);
    } else {
      sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      if (typeof window !== "undefined") sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
      router.push(afterAuthPath);
      replaceBrowserPathStripHash(afterAuthPath);
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  // Don't flash the login form while we're checking the session or while the
  // already-signed-in redirect above is in flight.
  if (authLoading || user) {
    return <div className="auth-card">Loading...</div>;
  }

  return (
    <div className="auth-card">
      <span className="auth-tag">Travel Scout</span>
      <h1>Welcome Back</h1>

      {message && <div className="auth-footer" style={{ color: "var(--green)", marginBottom: "1rem" }}>{message}</div>}
      {(error || urlError) && <div className="auth-error">{error || urlError}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <p className="auth-footer" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            <Link href="/auth/forgot-password">Forgot password?</Link>
          </p>
        </div>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <div className="auth-divider">
        <span>Or continue with</span>
      </div>

      <button
        type="button"
        onClick={() => {
          const raw = searchParams.get("redirect");
          router.push(
            raw != null && raw !== ""
              ? `/oauth/consent?redirect=${encodeURIComponent(getSafeRedirectPath(raw))}`
              : "/oauth/consent"
          );
        }}
        disabled={loading}
        className="auth-google"
      >
        <GoogleIcon size={18} />
        Google
      </button>

      <p className="auth-footer">
        Don&apos;t have an account?{" "}
        <Link
          href={(() => {
            const raw = searchParams.get("redirect");
            if (raw != null && raw !== "")
              return `/auth/signup?redirect=${encodeURIComponent(getSafeRedirectPath(raw))}`;
            return "/auth/signup";
          })()}
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

