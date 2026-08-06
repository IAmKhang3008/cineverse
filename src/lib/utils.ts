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

// Avatar mặc định cho diễn viên — tỷ lệ 2:3 phù hợp grid
export const CAST_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect fill='%232a2a2a' width='200' height='300'/%3E%3Ccircle cx='100' cy='110' r='50' fill='%23555555'/%3E%3Cellipse cx='100' cy='230' rx='70' ry='50' fill='%23555555'/%3E%3C/svg%3E";

export const DEFAULT_USER_AVATAR = "https://ui-avatars.com/api/?name=User&background=E50914&color=fff&size=256&rounded=true&bold=true";

export function cleanLangString(lang: string | null | undefined): string {
  if (!lang) return '';
  const tokens = lang.trim().split(/\s+/);
  const seen = new Set<string>();
  const resultTokens: string[] = [];
  
  for (const token of tokens) {
    const cleanWord = token.toLowerCase().replace(/^[+,\-/]+|[+,\-/]+$/g, '');
    if (cleanWord && seen.has(cleanWord)) {
      continue;
    }
    if (cleanWord) {
      seen.add(cleanWord);
    }
    resultTokens.push(token);
  }
  
  let cleaned = resultTokens.join(' ');
  cleaned = cleaned.replace(/\s*([+,\-/])\s*\1+/g, ' $1');
  cleaned = cleaned.replace(/\s*([+,\-/])\s*$/g, '');
  cleaned = cleaned.replace(/^\s*([+,\-/])\s*/g, '');
  return cleaned.trim();
}

/**
 * Viết hoa chữ cái đầu mỗi từ — hỗ trợ tiếng Việt có dấu
 * "nhóc trùm: đi làm lại" → "Nhóc Trùm: Đi Làm Lại"
 */
export function toMovieTitleCase(str: string): string {
  if (!str) return '';
  // Xóa HTML tags nếu có (phimapi đôi khi trả về HTML trong tên)
  const plain = str.replace(/<[^>]*>/g, '');
  return plain
    .split(' ')
    .map(word => {
      if (!word) return word;
      // Viết hoa ký tự đầu, giữ nguyên phần còn lại
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
