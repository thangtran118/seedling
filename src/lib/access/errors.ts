// Thrown by the access layer; actions turn it into a user-facing message, pages into notFound().
export class AccessError extends Error {
  constructor(
    public readonly code: "not_found" | "forbidden" | "invalid" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export const notFoundError = (what = "Không tìm thấy dữ liệu.") => new AccessError("not_found", what);
export const forbiddenError = (what = "Bạn không có quyền làm việc này.") => new AccessError("forbidden", what);
export const invalidError = (what: string) => new AccessError("invalid", what);
