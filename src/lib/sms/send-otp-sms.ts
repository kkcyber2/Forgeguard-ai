/**
 * SMS OTP delivery — Twilio primary, console fallback in development.
 */

export async function sendOtpSms(
  phone: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) {
    console.error(
      "[sms:twilio] TWILIO_ACCOUNT_SID is not set — cannot send SMS. " +
        "Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    );
  }

  if (accountSid && authToken && from) {
    const body = new URLSearchParams({
      To: phone.startsWith("+") ? phone : `+${phone}`,
      From: from,
      Body: `ForgeGuard clearance code: ${code}. Expires in 10 minutes.`,
    });

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("[sms:twilio]", resp.status, text.slice(0, 300));
      return { ok: false, error: "SMS delivery failed. Try again shortly." };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[verify:otp:dev] ${phone} → ${code}`);
    return { ok: true };
  }

  return {
    ok: false,
    error: "SMS provider not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.",
  };
}
