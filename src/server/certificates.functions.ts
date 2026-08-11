import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const verifyCertificateInput = z.object({
  code: z.string().trim().min(8).max(120),
});

const ensureCertificateInput = z.object({
  accessToken: z.string().min(20),
});

const adminCertificateInput = z.object({
  accessToken: z.string().min(20),
  certificateId: z.string().uuid(),
});

export const verifyCertificate = createServerFn({ method: "POST" })
  .inputValidator((data) => verifyCertificateInput.parse(data))
  .handler(async ({ data }) => {
    const { getCertificateByCode } = await import("./certificates.server");
    return await getCertificateByCode(data.code);
  });

export const ensureCurrentUserCertificate = createServerFn({ method: "POST" })
  .inputValidator((data) => ensureCertificateInput.parse(data))
  .handler(async ({ data }) => {
    const [{ getUserIdForAccessToken }, { maybeIssueCertificate }] = await Promise.all([
      import("./admin-auth.server"),
      import("./certificates.server"),
    ]);
    const userId = await getUserIdForAccessToken(data.accessToken);
    return await maybeIssueCertificate(userId);
  });

export const listAdminCertificates = createServerFn({ method: "POST" })
  .inputValidator((data) => ensureCertificateInput.parse(data))
  .handler(async ({ data }) => {
    const [{ getRolesForAccessToken }, { listCertificatesForAdmin }] = await Promise.all([
      import("./admin-auth.server"),
      import("./certificates.server"),
    ]);
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");

    return await listCertificatesForAdmin();
  });

export const revokeAdminCertificate = createServerFn({ method: "POST" })
  .inputValidator((data) => adminCertificateInput.parse(data))
  .handler(async ({ data }) => {
    const [{ getRolesForAccessToken }, { revokeCertificateForAdmin }] = await Promise.all([
      import("./admin-auth.server"),
      import("./certificates.server"),
    ]);
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");

    return await revokeCertificateForAdmin(data.certificateId);
  });

export const restoreAdminCertificate = createServerFn({ method: "POST" })
  .inputValidator((data) => adminCertificateInput.parse(data))
  .handler(async ({ data }) => {
    const [{ getRolesForAccessToken }, { restoreCertificateForAdmin }] = await Promise.all([
      import("./admin-auth.server"),
      import("./certificates.server"),
    ]);
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");

    return await restoreCertificateForAdmin(data.certificateId);
  });

export const deleteAdminCertificate = createServerFn({ method: "POST" })
  .inputValidator((data) => adminCertificateInput.parse(data))
  .handler(async ({ data }) => {
    const [{ getRolesForAccessToken }, { deleteCertificateForAdmin }] = await Promise.all([
      import("./admin-auth.server"),
      import("./certificates.server"),
    ]);
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");

    return await deleteCertificateForAdmin(data.certificateId);
  });
