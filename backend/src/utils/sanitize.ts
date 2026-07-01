const HTML_ENTITY: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ENTITY[c] || c);
}

export function sanitizeString(val: unknown): string {
  if (typeof val !== 'string') return '';
  return escapeHtml(val.trim()).slice(0, 5000);
}

export function sanitizeEmail(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
}

export function sanitizePhone(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[^\d\-+() ]/g, '').slice(0, 20);
}

export function validatePassword(val: unknown): string | null {
  if (typeof val !== 'string') return '비밀번호를 입력해주세요.';
  if (val.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (val.length > 20) return '비밀번호는 20자 이하여야 합니다.';
  if (!/[a-zA-Z]/.test(val)) return '비밀번호에 영문자를 포함해주세요.';
  if (!/[0-9]/.test(val)) return '비밀번호에 숫자를 포함해주세요.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(val)) return '비밀번호에 특수문자를 포함해주세요.';
  return null;
}

export function sanitizeBirthDate(val: unknown): string {
  if (typeof val !== 'string') return '';
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  const y = parseInt(digits.slice(0, 4));
  const m = parseInt(digits.slice(4, 6));
  const d = parseInt(digits.slice(6, 8));
  if (y < 1900 || y > new Date().getFullYear() || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return digits;
}
