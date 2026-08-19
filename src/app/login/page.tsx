"use client";

import { AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BRAND_FULL_NAME, BRAND_TAGLINE } from "@/lib/constants/brand";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Login failed");
        setSubmitting(false);
        return;
      }
      // Full navigation, not client-side routing — guarantees the request
      // that loads /dashboard carries the just-set session cookie.
      window.location.href = "/dashboard";
    } catch {
      setError("Login failed — check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4">
      <Card className="w-full max-w-sm border-2 shadow-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <LogoMark size={30} />
          </div>
          <CardTitle className="text-2xl">{BRAND_FULL_NAME}</CardTitle>
          <CardDescription>{BRAND_TAGLINE}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  aria-invalid={error != null}
                  className="h-10 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {error ? (
                <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {error}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="h-10 w-full" disabled={submitting || !password}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            This app is private. You&apos;ll stay signed in on this device for 30 days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
