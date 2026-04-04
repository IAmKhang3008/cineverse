import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import he from "he";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function decodeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return he.decode(text);
}

export const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=User&background=2A2A2A&color=fff&size=256&rounded=true&bold=true";

export const DEFAULT_USER_AVATAR = "https://ui-avatars.com/api/?name=User&background=E50914&color=fff&size=256&rounded=true&bold=true";
