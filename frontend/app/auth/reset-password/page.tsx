"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      // Supabase processes the hash from the reset link and establishes a session.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setValid(true);
      } else {
        router.push("/auth/login?error=Invalid+or+expired+reset+link");
      }
      setReady(true);
    };
    init();
  }, [router]);

  if (!ready) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-footer">Loading...</p>
        </div>
      </div>
    );
  }

  if (!valid) return null;

  return (
    <div className="auth-page">
      <ResetPasswordForm />
    </div>
  );
}
