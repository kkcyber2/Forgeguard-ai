"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export interface NotifPrefsState {
  ok: boolean;
  error?: string;
}

export async function saveNotificationPrefs(
  _prev: NotifPrefsState,
  formData: FormData,
): Promise<NotifPrefsState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorised." };

  const emailOnComplete = formData.get("email_on_scan_complete") === "on";
  const emailOnBreach = formData.get("email_on_breach") === "on";
  const webhookUrl = String(formData.get("webhook_url") ?? "").trim();
  const webhookSecret = String(formData.get("webhook_secret") ?? "").trim();

  if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) {
    return { ok: false, error: "Webhook URL must start with http(s)://" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        email_on_scan_complete: emailOnComplete,
        email_on_breach: emailOnBreach,
        webhook_url: webhookUrl || null,
        webhook_secret: webhookSecret || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[settings/notifications] upsert error:", error);
    return { ok: false, error: "Could not save notification preferences." };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
