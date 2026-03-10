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
