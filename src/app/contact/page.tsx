"use client";

import * as React from "react";
import { Send, Shield, AlertTriangle, MessageSquare, ChevronDown } from "lucide-react";

const TOPICS = [
  "Enterprise Sales",
  "Security Research / Responsible Disclosure",
  "Bug Report",
  "Partnership",
  "Technical Support",
  "Other",
];

export default function ContactPage() {
  const [topic, setTopic] = React.useState("");
  const [form, setForm] = React.useState({ name: "", email: "", message: "" });
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    // Simulate send — in production, wire to /api/contact or Resend
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("sent");
  }

  const isDisc = topic === "Security Research / Responsible Disclosure";

  return (
    <main className="relative w-full min-h-screen pt-28 pb-24">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-grid-hairline bg-grid-lg opacity-[0.3]" />

      <div className="relative mx-auto max-w-4xl px-6 md:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-acid mb-4">
          // contact
        </p>
        <h1 className="text-3xl font-bold text-foreground md:text-4xl mb-2">
          Get in touch
        </h1>
        <p className="text-sm text-foreground-muted mb-12 max-w-lg">
          We respond within 24 hours on business days. Security disclosures
          are triaged within 4 hours, always.
        </p>

        <div className="grid gap-10 md:grid-cols-5">
          {/* Left — form */}
          <div className="md:col-span-3">
            {status === "sent" ? (
              <div className="rounded-sm border border-acid/30 bg-acid/5 p-8 text-center">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-sm border border-acid/30 bg-acid/10">
                  <Send size={18} className="text-acid" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Message received</h3>
                <p className="text-[13px] text-foreground-muted">
                  We'll respond to <span className="text-foreground">{form.email}</span> shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Topic */}
                <div>
                  <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-foreground-subtle">
                    Topic
                  </label>
                  <div className="relative">
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      required
                      className="w-full appearance-none rounded-sm border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-foreground-subtle focus:border-acid/40 focus:outline-none focus:ring-0 transition-colors"
                    >
                      <option value="" disabled className="bg-obsidian-950">
                        Select a topic…
                      </option>
                      {TOPICS.map((t) => (
                        <option key={t} value={t} className="bg-obsidian-950">
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
                    />
                  </div>
                </div>

                {/* Disclosure notice */}
                {isDisc && (
                  <div className="flex items-start gap-3 rounded-sm border border-amber-400/20 bg-amber-400/5 p-4">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-mono text-[11px] font-semibold text-amber-400 mb-1">
                        Responsible Disclosure
                      </p>
                      <p className="text-[12px] text-foreground-muted leading-relaxed">
                        We follow a 90-day disclosure timeline. Please do not
                        publish or share findings until we've had a chance to
                        remediate. We maintain a Hall of Fame and honor CVE
                        credits for all qualifying reports.
                      </p>
                    </div>
                  </div>
                )}

                {/* Name / Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-foreground-subtle">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="Your name"
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-sm border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle focus:border-acid/40 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-foreground-subtle">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-sm border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-subtle focus:border-acid/40 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-foreground-subtle">
                    Message
                  </label>
                  <textarea
                    rows={6}
                    placeholder={
                      isDisc
                        ? "Describe the vulnerability, affected endpoint, and reproduction steps…"
                        : "Tell us what you need…"
                    }
                    required
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full resize-none rounded-sm border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-foreground-subtle focus:border-acid/40 focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex items-center gap-2 rounded-sm border border-acid/50 bg-acid/10 px-6 py-2.5 text-sm font-semibold text-acid transition-colors hover:bg-acid/20 disabled:opacity-50"
                >
                  {status === "sending" ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border border-acid/60 border-t-acid" />
                      Transmitting…
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Send message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right — contact info */}
          <div className="md:col-span-2 space-y-4">
            <ContactCard
              icon={MessageSquare}
              title="General enquiries"
              lines={["hello@forgeguard.ai", "Response within 24h"]}
            />
            <ContactCard
              icon={Shield}
              title="Security disclosures"
              lines={["security@forgeguard.ai", "Triaged within 4h"]}
              accent
            />
            <ContactCard
              icon={AlertTriangle}
              title="Enterprise sales"
              lines={["enterprise@forgeguard.ai", "Custom pricing + SLA"]}
            />

            <div className="rounded-sm border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-subtle mb-3">
                PGP / Secure comms
              </p>
              <p className="text-[12px] text-foreground-muted leading-relaxed">
                For sensitive disclosures, request our PGP public key via
                security@forgeguard.ai before sending. Fingerprint published
                on Keybase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ContactCard({
  icon: Icon,
  title,
  lines,
  accent,
}: {
  icon: React.ElementType;
  title: string;
  lines: string[];
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-5 ${
        accent
          ? "border-acid/20 bg-acid/[0.04]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon size={14} strokeWidth={1.5} className={accent ? "text-acid" : "text-foreground-subtle"} />
        <p className="font-mono text-[11px] uppercase tracking-widest text-foreground-subtle">
          {title}
        </p>
      </div>
      {lines.map((l) => (
        <p key={l} className="text-[13px] text-foreground-muted">
          {l}
        </p>
      ))}
    </div>
  );
}
