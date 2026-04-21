"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Fingerprint,
  AlertCircle,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";

const emptyMfa = ["", "", "", "", "", ""];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("admin@fortexa.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaDigits, setMfaDigits] = useState(emptyMfa);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
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

  const handlePasswordStep = async () => {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
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

    router.push(nextPath);
    router.refresh();
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

    router.push(nextPath);
    router.refresh();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!showMfa) {
        await handlePasswordStep();
      } else {
        await handleMfaStep();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0C0C0F] via-[#0C1222] to-[#131316] lg:flex lg:w-[55%]">
        <div className="absolute inset-0 opacity-[0.08]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(59,130,246,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.28) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="absolute left-20 top-20 h-32 w-32 rounded-full bg-[#0C5CAB]/18 blur-3xl animate-pulse" />
        <div
          className="absolute bottom-32 right-20 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute left-1/3 top-1/2 h-24 w-24 rounded-full bg-sky-400/10 blur-2xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-accent glow-brand">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="heading-tight text-3xl font-bold tracking-tight">
              Forte<span className="text-[#93C5FD]">xa</span>
            </span>
          </div>

          <h1 className="heading-tight mb-5 text-4xl font-bold leading-tight">
            Proactive Vulnerability
            <br />
            Management for ATM/GAB
            <br />
            <span className="text-[#93C5FD]">Environments</span>
          </h1>

          <p className="mb-10 max-w-lg text-base leading-relaxed text-white/72">
            Intelligent decision-support platform for banking security teams.
            Import scans, enrich CVEs with AI, prioritize by business context,
            and track remediation across your entire ATM fleet.
          </p>

          <div className="grid max-w-md grid-cols-2 gap-4">
            {[
              { value: "1,200+", label: "ATMs Monitored" },
              { value: "4,800+", label: "CVEs Tracked" },
              { value: "98.5%", label: "SLA Compliance" },
              { value: "< 4 Days", label: "Avg. MTTR" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-sm"
              >
                <p className="text-2xl font-bold text-[#93C5FD]">{stat.value}</p>
                <p className="mt-0.5 text-xs text-white/65">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-16 right-16 flex items-center justify-between text-xs text-white/50">
          <span>© 2026 Fortexa Security Platform</span>
          <span>Enterprise Banking Solutions</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#F8F9FA] px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-accent">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#1A1A2E]">
              Forte<span className="text-[#0C5CAB]">xa</span>
            </span>
          </div>

          <div className="mb-8">
            <h2 className="heading-tight text-2xl font-bold text-[#1A1A2E]">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-[#6B7280]">
              Sign in to your Fortexa account
            </p>
          </div>

          <Card className="border border-[#E9ECEF] bg-white p-7 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!showMfa ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-[#374151]">
                      Email address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@fortexa.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-11 border-[#E9ECEF] bg-[#F3F4F6] pl-10 text-[#1A1A2E] placeholder:text-[#9CA3AF] focus:border-[#0C5CAB] focus:ring-[#0C5CAB]/20"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-[#374151]">
                        Password
                      </Label>
                      <button
                        type="button"
                        className="text-xs font-medium text-[#0C5CAB] hover:text-[#0a4a8a]"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-11 border-[#E9ECEF] bg-[#F3F4F6] pl-10 pr-10 text-[#1A1A2E] placeholder:text-[#9CA3AF] focus:border-[#0C5CAB] focus:ring-[#0C5CAB]/20"
                        autoComplete="current-password"
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

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      className="data-[state=checked]:border-[#0C5CAB] data-[state=checked]:bg-[#0C5CAB]"
                    />
                    <Label
                      htmlFor="remember"
                      className="cursor-pointer text-sm text-[#6B7280]"
                    >
                      Remember me
                    </Label>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#0C5CAB]">
                      <Fingerprint className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A2E]">
                        Two-Factor Authentication
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        Enter the 6-digit code from your authenticator app
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
                        className="h-12 w-11 border-[#E9ECEF] bg-[#F3F4F6] text-center text-lg font-bold text-[#1A1A2E] focus:border-[#0C5CAB] focus:ring-[#0C5CAB]/20"
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={resetMfa}
                    className="text-xs font-medium text-[#0C5CAB] hover:text-[#0a4a8a]"
                  >
                    ← Back to login
                  </button>
                </div>
              )}

              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                className="glow-brand h-11 w-full font-semibold text-white"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Verifying...
                  </span>
                ) : showMfa ? (
                  "Verify & Sign In"
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
