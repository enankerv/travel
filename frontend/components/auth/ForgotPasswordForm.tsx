"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPasswordForEmail } from "@/lib/supabase";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPasswordForEmail(email);
    } finally {
      setLoading(false);
    }
    // Always show success - never reveal whether the email exists
    setSent(true);
  }

  if (sent) {
    return (
      <div className="auth-card">
        <span className="auth-tag">Travel Scout</span>
        <h1>Check your email</h1>
        <p className="auth-footer" style={{ marginTop: "1rem" }}>
          We sent a password reset link to <strong>{email}</strong>. Click the
          link to set a new password.
        </p>
        <p className="auth-footer" style={{ marginTop: "1.5rem" }}>
          <Link href="/auth/login">Back to login</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <span className="auth-tag">Travel Scout</span>
      <h1>Forgot password</h1>
      <p className="auth-footer" style={{ marginBottom: "1rem" }}>
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

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

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="auth-footer" style={{ marginTop: "1.5rem" }}>
        <Link href="/auth/login">Back to login</Link>
      </p>
    </div>
  );
}
