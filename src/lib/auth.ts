import type { User } from "@supabase/supabase-js";

export type Teacher = {
  name: string;
  username: string;
  position: string;
  email?: string;
};

export function teacherFromAuthUser(user: User): Teacher {
  const metadata = user.user_metadata ?? {};
  const fallbackEmail = user.email ?? "";

  return {
    name: String(metadata.name ?? metadata.full_name ?? fallbackEmail.split("@")[0] ?? "Teacher"),
    username: String(metadata.username ?? fallbackEmail.split("@")[0] ?? "teacher"),
    position: String(metadata.position ?? "Teacher"),
    email: fallbackEmail || undefined,
  };
}
