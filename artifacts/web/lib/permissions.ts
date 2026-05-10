// TODO: Wire role-based logic in Mini-wave 2
import type { User } from "@/lib/api/mock";

export function can(
  _user: User,
  _action: string,
  _resource: string
): boolean {
  return true;
}
