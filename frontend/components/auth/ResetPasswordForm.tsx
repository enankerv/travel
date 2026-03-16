"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updatePassword } from "@/lib/supabase";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      router.push("/auth/login?message=Password+reset.+Sign+in+with+your+new+password.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <span className="auth-tag">Travel Scout</span>
      <h1>Set new password</h1>
      <p className="auth-footer" style={{ marginBottom: "1rem" }}>
        Enter your new password below.
      </p>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="auth-footer" style={{ marginTop: "1.5rem" }}>
        <Link href="/auth/login">Back to login</Link>
      </p>
    </div>
  );
}
