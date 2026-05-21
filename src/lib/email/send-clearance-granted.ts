import "server-only";

export async function sendClearanceGrantedEmail(
  to: string,
  fullName: string | null,
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "ForgeGuard <clearance@forgeguard.ai>";
  const name = fullName ?? "Operator";

  if (!resendKey) {
    console.log(`[clearance-email] DEV — Clearance Granted → ${to} (${name})`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Clearance Granted — ForgeGuard Sovereign Access",
      html: `<p>${name},</p><p>Your <strong>Sovereign clearance</strong> has been granted. Access level 5 is now active on your operator account.</p><p style="font-family:monospace;font-size:12px;color:#666">ForgeGuard AI — Stronghold 2.0</p>`,
    }),
  });

  if (!res.ok) {
    console.error("[clearance-email] Resend failed:", await res.text());
  }
}
