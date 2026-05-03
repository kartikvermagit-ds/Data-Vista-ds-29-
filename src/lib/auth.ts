import type { User } from "@supabase/supabase-js";

export type Teacher = {
  id?: string;
  name: string;
  username: string;
  position: string;
  email?: string;
};

/** Application-level role derived from the teacher's position string. */
export type UserRole = "teacher" | "hod" | "dean";

export function getRoleFromPosition(position: string): UserRole {
  const p = position.toLowerCase();
  if (p.includes("dean") || p.includes("principal") || p.includes("director")) return "dean";
  if (p.includes("hod") || p.includes("head of department") || p.includes("head")) return "hod";
  return "teacher";
}

export function teacherFromAuthUser(user: User): Teacher {
  const metadata = user.user_metadata ?? {};
  const fallbackEmail = user.email ?? "";

  return {
    id: user.id,
    name: String(metadata.name ?? metadata.full_name ?? fallbackEmail.split("@")[0] ?? "Teacher"),
    username: String(metadata.username ?? fallbackEmail.split("@")[0] ?? "teacher"),
    position: String(metadata.position ?? "Teacher"),
    email: fallbackEmail || undefined,
  };
}
