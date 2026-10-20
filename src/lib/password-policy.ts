export const PASSWORD_MIN_LENGTH = 8;

// Returns a Vietnamese error message, or null when the password is acceptable.
export function checkPasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Mật khẩu cần có cả chữ và số.";
  return null;
}
