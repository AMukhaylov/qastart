import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const COURSE_TITLE = "Инженер по тестированию ПО";
export const MENTOR_NAME = "Артур Мухайлов";

export type CertificateRow = {
  id: string;
  user_id: string;
  certificate_number: string;
  verification_code: string;
  course_title: string;
  student_name: string;
  mentor_name: string;
  issued_at: string;
  revoked_at: string | null;
};

const CERTIFICATE_SELECT =
  "id,user_id,certificate_number,verification_code,course_title,student_name,mentor_name,issued_at,revoked_at";

function certificateNumber() {
  const year = new Date().getFullYear();
  const suffix = globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
  return `QA-${year}-${suffix}`;
}

function verificationCode() {
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}

async function getStudentName(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.full_name?.trim()) return profile.full_name.trim();

  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const metadataName = data.user?.user_metadata?.full_name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();

  return data.user?.email?.split("@")[0] ?? "Студент QA школы";
}

async function findActiveCertificate(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("certificates")
    .select(CERTIFICATE_SELECT)
    .eq("user_id", userId)
    .eq("course_title", COURSE_TITLE)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw error;
  return data as CertificateRow | null;
}

export async function maybeIssueCertificate(userId: string) {
  const existing = await findActiveCertificate(userId);
  if (existing) return existing;

  const [{ data: lessons, error: lessonsError }, { data: progress, error: progressError }] =
    await Promise.all([
      supabaseAdmin.from("lessons").select("id"),
      supabaseAdmin
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", userId)
        .eq("completed", true),
    ]);

  if (lessonsError) throw lessonsError;
  if (progressError) throw progressError;

  const lessonCount = lessons?.length ?? 0;
  if (lessonCount === 0 || (progress?.length ?? 0) < lessonCount) return null;

  const studentName = await getStudentName(userId);

  const { data, error } = await supabaseAdmin
    .from("certificates")
    .insert({
      user_id: userId,
      certificate_number: certificateNumber(),
      verification_code: verificationCode(),
      course_title: COURSE_TITLE,
      student_name: studentName,
      mentor_name: MENTOR_NAME,
    })
    .select(CERTIFICATE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") return await findActiveCertificate(userId);
    throw error;
  }

  return data as CertificateRow;
}

export async function getCertificateByCode(code: string) {
  const { data: certificate, error } = await supabaseAdmin
    .from("certificates")
    .select(
      "certificate_number,verification_code,course_title,student_name,mentor_name,issued_at,revoked_at",
    )
    .eq("verification_code", code)
    .maybeSingle();

  if (error) throw error;
  if (!certificate) return null;

  return certificate;
}

export async function listCertificatesForAdmin() {
  const { data, error } = await supabaseAdmin
    .from("certificates")
    .select(CERTIFICATE_SELECT)
    .order("issued_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CertificateRow[];
}

export async function revokeCertificateForAdmin(certificateId: string) {
  const { data, error } = await supabaseAdmin
    .from("certificates")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", certificateId)
    .is("revoked_at", null)
    .select(CERTIFICATE_SELECT)
    .single();

  if (error) throw error;
  return data as CertificateRow;
}

export async function restoreCertificateForAdmin(certificateId: string) {
  const { data, error } = await supabaseAdmin
    .from("certificates")
    .update({ revoked_at: null })
    .eq("id", certificateId)
    .not("revoked_at", "is", null)
    .select(CERTIFICATE_SELECT)
    .single();

  if (error) throw error;
  return data as CertificateRow;
}

export async function deleteCertificateForAdmin(certificateId: string) {
  const { error } = await supabaseAdmin.from("certificates").delete().eq("id", certificateId);
  if (error) throw error;
  return { ok: true };
}
