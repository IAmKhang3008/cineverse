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
