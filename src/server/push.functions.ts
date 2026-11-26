import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getUserIdForAccessToken } from "./admin-auth.server";

export const getWebPushPublicKey = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(20) }).parse(data))
  .handler(async ({ data }) => {
    await getUserIdForAccessToken(data.accessToken);
    return process.env.VAPID_PUBLIC_KEY || null;
  });
