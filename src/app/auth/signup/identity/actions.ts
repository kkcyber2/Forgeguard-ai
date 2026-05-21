"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type UserType = "client" | "hacker" | "developer";

const ACCESS_LEVELS: Record<UserType, number> = {
  client:    1,
  hacker:    2,
  developer: 3,
};

export async function setUserIdentity(userType: UserType): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const admin = createAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("profiles")
    .update({
      user_type:    userType,
      access_level: ACCESS_LEVELS[userType],
    })
    .eq("id", user.id);

  redirect("/dashboard");
}
