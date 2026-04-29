"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "signin" | "signup";

const emptyMfa = ["", "", "", "", "", ""];
const AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;
const passwordMinLength = 8;

async function waitForAuthCookie(timeoutMs = 1_500) {
  const startedAt = Date.now();

  while (!AUTH_COOKIE_PATTERN.test(document.cookie)) {
    if (Date.now() - startedAt >= timeoutMs) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = getSafeRedirectPath(searchParams.get("next"));
  const supabase = createSupabaseBrowserClient();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaDigits, setMfaDigits] = useState(emptyMfa);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setShowMfa(false);
    setMfaDigits(emptyMfa);
    setFactorId(null);
  };

  const resetMfa = async () => {
    setShowMfa(false);
    setMfaDigits(emptyMfa);
    setFactorId(null);
    setError(null);
    await supabase.auth.signOut();
  };

  const handleMfaChange = (index: number, value: string) => {
    const nextDigit = value.replace(/\D/g, "").slice(-1);

    setMfaDigits((currentDigits) => {
      const nextDigits = [...currentDigits];
      nextDigits[index] = nextDigit;
      return nextDigits;
    });

    if (nextDigit && index < emptyMfa.length - 1) {
      focusInput(index + 1);
    }
  };

  const handleMfaKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace" && !mfaDigits[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const validatePasswordForm = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!emailLooksValid(normalizedEmail)) {
      setError("Enter a valid work email address.");
      return null;
    }

    if (password.length < passwordMinLength) {
      setError(`Password must be at least ${passwordMinLength} characters.`);
      return null;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return null;
    }

    return normalizedEmail;
  };

  const handlePasswordStep = async () => {
    const normalizedEmail = validatePasswordForm();

    if (!normalizedEmail) {
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const { data: assuranceData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (
      assuranceData?.currentLevel !== "aal2" &&
      assuranceData?.nextLevel === "aal2"
    ) {
      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setError(factorsError.message);
        return;
      }

      const factor =
        factorsData.totp.find((item) => item.status === "verified") ??
        factorsData.phone.find((item) => item.status === "verified");

      if (!factor) {
        setError(
          "MFA is required for this account, but no verified factor is available."
        );
        await supabase.auth.signOut();
        return;
      }

      setFactorId(factor.id);
      setShowMfa(true);
      window.setTimeout(() => focusInput(0), 0);
      return;
    }

    await waitForAuthCookie();
    window.location.assign(nextPath);
  };

  const handleSignUp = async () => {
    const normalizedEmail = validatePasswordForm();

    if (!normalizedEmail) {
      return;
    }

    const afterSignupPath = nextPath.startsWith("/invite/")
      ? nextPath
      : "/onboarding";
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(afterSignupPath)}`;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName.trim(),
          product_context: "atm_gab_vulnerability_operations",
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      await waitForAuthCookie();
      window.location.assign(afterSignupPath);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(
      nextPath.startsWith("/invite/")
        ? "Check your email to finish account creation, then Fortexa will reopen this invite."
        : "Check your email to finish account creation, then Fortexa will open onboarding."
    );
  };

  const handleMfaStep = async () => {
    const code = mfaDigits.join("");

    if (!factorId) {
      setError("No MFA factor is active for this session.");
      return;
    }

    if (code.length !== emptyMfa.length) {
      const firstEmptyIndex = mfaDigits.findIndex((digit) => digit === "");
      focusInput(firstEmptyIndex === -1 ? 0 : firstEmptyIndex);
      return;
    }

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({
        factorId,
      });

    if (challengeError) {
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    await waitForAuthCookie();
    window.location.assign(nextPath);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (showMfa) {
        await handleMfaStep();
      } else if (mode === "signup") {
        await handleSignUp();
      } else {
        await handlePasswordStep();
      }
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = showMfa
    ? "Verify code"
    : mode === "signup"
      ? "Create account"
      : "Sign in";

  return (
    <main
      id="main-content"
      className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[48fr_52fr]"
    >
      <section className="flex items-center justify-center bg-white px-6 py-8 sm:px-10 lg:px-14 xl:px-20">
        <div className="w-full max-w-[400px]">
          <Image
            src="/pics/logo.png"
            alt="Fortexa"
            width={180}
            height={50}
            className="mb-6 h-auto w-[180px]"
            priority
          />

          <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#1A1A2E]">
            {mode === "signup" ? "Create your account" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
            {mode === "signup"
              ? "Start your ATM/GAB security onboarding."
              : "Access your Fortexa security workspace."}
          </p>

          {!showMfa && (
            <div className="mt-4 grid grid-cols-2 rounded-xl bg-[#F0F2F5] p-1">
              {(["signin", "signup"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchMode(value)}
                  className={`h-9 rounded-lg text-sm font-semibold transition-all ${
                    mode === value
                      ? "bg-white text-[#1A1A2E] shadow-sm"
                      : "text-[#6B7280] hover:text-[#1A1A2E]"
                  }`}
                >
                  {value === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {!showMfa ? (
              <>
{mode === "signup" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="full-name">Name</Label>
                    <Input
                      id="full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Security lead"
                      className="h-10 border-[#E5E7EB] bg-white text-[#1A1A2E] placeholder:text-[#6B7280]"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      className="h-10 border-[#E5E7EB] bg-white pl-10 text-[#1A1A2E] placeholder:text-[#6B7280]"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" ? (
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed text-xs font-medium text-[#6B7280]"
                        title="Password recovery is not enabled in this MVP yet."
                      >
                        Recovery not enabled
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      className="h-10 border-[#E5E7EB] bg-white pl-10 pr-10 text-[#1A1A2E] placeholder:text-[#6B7280]"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1A1A2E]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {mode === "signup" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat password"
                      className="h-10 border-[#E5E7EB] bg-white text-[#1A1A2E] placeholder:text-[#6B7280]"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#0C5CAB]">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A2E]">
                      Two-factor authentication
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      Enter the 6-digit code from your authenticator app.
                    </p>
                  </div>
                </div>
                <div className="flex justify-center gap-2">
                  {mfaDigits.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(element) => {
                        inputRefs.current[index] = element;
                      }}
                      value={digit}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      aria-label={`Verification digit ${index + 1}`}
                      onChange={(event) =>
                        handleMfaChange(index, event.target.value)
                      }
                      onKeyDown={(event) => handleMfaKeyDown(index, event)}
                      className="h-12 w-11 border-[#E5E7EB] bg-white text-center text-lg font-bold text-[#1A1A2E]"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={resetMfa}
                  className="text-xs font-semibold text-[#0C5CAB] hover:text-[#0a4a8a]"
                >
                  Back to password
                </button>
              </div>
            )}

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full border-0 bg-[#0C5CAB] font-semibold text-white shadow-[0_8px_24px_rgba(12,92,171,0.25)] hover:bg-[#0a4a8a]"
            >
              {loading ? "Securing session..." : submitLabel}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          {mode === "signin" && (
            <p className="mt-3 text-sm text-[#6B7280]">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-semibold text-[#0C5CAB] hover:text-[#0a4a8a]"
              >
                Sign up
              </button>
            </p>
          )}
          {mode === "signup" && (
            <p className="mt-3 text-sm text-[#6B7280]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-semibold text-[#0C5CAB] hover:text-[#0a4a8a]"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </section>

      <section className="relative hidden lg:block">
        <Image
          src="/pics/secondPic.png"
          alt="Fortexa ATM/GAB security platform"
          fill
          className="object-cover object-center"
          priority
        />
      </section>
    </main>
  );
}
