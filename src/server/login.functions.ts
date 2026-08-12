import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const input = z.object({
  login: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_]+$/, "Используйте латинские буквы, цифры и _"),
  password: z.string().min(6).max(72),
});

export const loginWithUsername = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("login", data.login)
      .maybeSingle();
    if (error || !profile) throw new Error("Неверный логин или пароль");

    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      profile.id,
    );
    if (userError || !userResult.user?.email || userResult.user.banned_until) {
      throw new Error("Неверный логин или пароль");
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Сервис авторизации временно недоступен");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signInError } = await client.auth.signInWithPassword({
      email: userResult.user.email,
      password: data.password,
    });
    if (signInError || !session.session) throw new Error("Неверный логин или пароль");
    return { session: session.session, isFirstLogin: !userResult.user.last_sign_in_at };
  });
