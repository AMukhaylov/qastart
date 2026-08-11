import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRolesForAccessToken } from "./admin-auth.server";

const rolesInput = z.object({ accessToken: z.string().min(20) });

export const getCurrentUserRoles = createServerFn({ method: "POST" })
  .inputValidator((data) => rolesInput.parse(data))
  .handler(async ({ data }) => getRolesForAccessToken(data.accessToken));
