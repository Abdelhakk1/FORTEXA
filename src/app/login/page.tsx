"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, Lock, Mail, ShieldCheck, Fingerprint, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMfa, setShowMfa] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMfa) {
      setShowMfa(true);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      {/* Left Panel: Branded Visual */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-[#0C0C0F] via-[#0C1222] to-[#131316] overflow-hidden">
        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(232,83,63,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(232,83,63,0.4) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        {/* Floating glow orbs */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-[#D8F3DC] rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-32 right-20 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-emerald-500/8 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-accent shadow-lg shadow-coral/30">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight heading-tight">
              Forte<span className="text-[#1B4332]">xa</span>
            </span>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-5 heading-tight">
            Proactive Vulnerability<br />
            Management for ATM/GAB<br />
            <span className="text-[#1B4332]">Environments</span>
          </h1>

          <p className="text-base text-[#6B7280] max-w-lg mb-10 leading-relaxed">
            Intelligent decision-support platform for banking security teams. Import scans, enrich CVEs with AI,
            prioritize by business context, and track remediation across your entire ATM fleet.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            {[
              { value: "1,200+", label: "ATMs Monitored" },
              { value: "4,800+", label: "CVEs Tracked" },
              { value: "98.5%", label: "SLA Compliance" },
              { value: "< 4 Days", label: "Avg. MTTR" },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#F9FAFB] backdrop-blur-sm border border-[#E9ECEF] rounded-xl px-4 py-3.5">
                <p className="text-2xl font-bold text-[#1B4332]">{stat.value}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="absolute bottom-6 left-16 right-16 flex items-center justify-between text-xs text-[#9CA3AF]">
          <span>© 2026 Fortexa Security Platform</span>
          <span>Enterprise Banking Solutions</span>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#F8F9FA]">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-accent">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Forte<span className="text-[#1B4332]">xa</span>
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#1A1A2E] heading-tight">Welcome back</h2>
            <p className="text-sm text-[#6B7280] mt-1.5">Sign in to your Fortexa account</p>
          </div>

          <Card className="p-7 border border-[#E9ECEF] bg-white">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!showMfa ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-[#6B7280]">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@fortexa.com"
                        defaultValue="admin@fortexa.com"
                        className="pl-10 h-11 bg-[#F3F4F6] border-[#E9ECEF] text-[#1A1A2E] placeholder:text-[#9CA3AF]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-[#6B7280]">Password</Label>
                      <button type="button" className="text-xs text-[#1B4332] hover:text-[#1B4332]-hover font-medium cursor-pointer">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        defaultValue="password123"
                        className="pl-10 pr-10 h-11 bg-[#F3F4F6] border-[#E9ECEF] text-[#1A1A2E] placeholder:text-[#9CA3AF]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1A1A2E] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" className="cursor-pointer border-white/[0.15] data-[state=checked]:bg-[#1B4332] data-[state=checked]:border-coral" />
                    <Label htmlFor="remember" className="text-sm text-[#6B7280] cursor-pointer">Remember me</Label>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1B4332]/12">
                      <Fingerprint className="h-5 w-5 text-[#1B4332]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Two-Factor Authentication</p>
                      <p className="text-xs text-[#6B7280]">Enter the 6-digit code from your authenticator app</p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {[...Array(6)].map((_, i) => (
                      <Input
                        key={i}
                        type="text"
                        maxLength={1}
                        className="w-11 h-12 text-center text-lg font-bold bg-[#F3F4F6] border-[#E9ECEF] text-white"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMfa(false)}
                    className="text-xs text-[#1B4332] hover:text-[#1B4332]-hover font-medium cursor-pointer"
                  >
                    ← Back to login
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 gradient-accent text-[#1A1A2E] font-semibold cursor-pointer glow-coral"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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

          {/* Trust Indicators */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-center gap-6">
              {[
                { icon: ShieldCheck, label: "256-bit TLS" },
                { icon: KeyRound, label: "MFA Enforced" },
                { icon: Lock, label: "SOC 2 Type II" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
