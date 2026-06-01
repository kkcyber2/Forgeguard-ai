"use client";

import { useState, useTransition } from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { sendOTP, verifyOTP } from "./verification-actions";

export function PhoneVerification({
  initialPhone,
  phoneVerified,
}: {
  initialPhone: string;
  phoneVerified: boolean;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(phoneVerified);
  const [pending, startTransition] = useTransition();

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const res = await sendOTP(phone);
      if (res.error) {
        console.error("[verify:otp:client]", res.error);
        setError(res.error);
      } else {
        setSent(true);
        if (res.devCode) setDevCode(res.devCode);
      }
    });
  }

  function handleVerify() {
    setError(null);
    startTransition(async () => {
      const res = await verifyOTP(phone, code);
      if (res.error) setError(res.error);
      else if (res.verified) {
        setVerified(true);
        setDevCode(null);
      }
    });
  }

  return (
    <form
      className="space-y-3 scroll-mt-24"
      id="clearance-phone"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2">
        <Phone size={12} className="text-[#D1FF00]/80" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Phone verification
        </p>
        {verified && (
          <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-[#D1FF00]">
            <ShieldCheck size={10} />
            Verified
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          disabled={verified}
          placeholder="+1 555 0100"
          autoComplete="tel"
          name="verification-phone"
          className="flex-1 rounded-[3px] border-[0.5px] border-white/10 bg-black/40 px-3 py-2 font-mono text-[12px] text-white placeholder:text-zinc-600 focus:border-[#D1FF00]/40 focus:outline-none"
        />
        {!verified && (
          <button
            type="button"
            onClick={handleSend}
            disabled={pending || !phone.trim()}
            className="flex items-center justify-center gap-1.5 rounded-[3px] border-[0.5px] border-[#D1FF00]/30 bg-[#D1FF00]/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[#D1FF00] disabled:opacity-40"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : null}
            Verify via SMS
          </button>
        )}
      </div>

      {sent && !verified && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (code.length >= 6 && !pending) handleVerify();
              }
            }}
            placeholder="6-digit code"
            autoComplete="off"
            name="verification-otp"
            className="w-full sm:w-36 rounded-[3px] border-[0.5px] border-white/10 bg-black/40 px-3 py-2 font-mono text-[12px] text-white tracking-[0.3em]"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={pending || code.length < 6}
            className="rounded-[3px] bg-[#D1FF00] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#050505] disabled:opacity-40"
          >
            Confirm code
          </button>
        </div>
      )}

      {devCode && (
        <p className="font-mono text-[10px] text-amber-400/90">
          Dev OTP: {devCode}
        </p>
      )}

      {error && (
        <p className="font-mono text-[10px] text-red-400/90">
          {error.includes("21608") || error.includes("TWILIO TRIAL LOCK")
            ? "TWILIO TRIAL LOCK: Add +923123583827 to Verified Caller IDs in Twilio Console."
            : error}
        </p>
      )}

      {!verified && error?.includes("SMS provider not configured") && (
        <p className="font-mono text-[10px] leading-relaxed text-white/35">
          Production SMS requires{" "}
          <code className="text-white/50">TWILIO_ACCOUNT_SID</code>,{" "}
          <code className="text-white/50">TWILIO_AUTH_TOKEN</code>, and{" "}
          <code className="text-white/50">TWILIO_PHONE_NUMBER</code> on Vercel,
          plus <code className="text-white/50">SUPABASE_SERVICE_ROLE_KEY</code> for
          OTP storage.
        </p>
      )}
    </form>
  );
}
