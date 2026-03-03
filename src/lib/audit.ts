import { prisma } from "./prisma";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "TOTP_SETUP_STARTED"
  | "TOTP_SETUP_COMPLETED"
  | "TOTP_VERIFY_SUCCESS"
  | "TOTP_VERIFY_FAILED"
  | "TOTP_ACCOUNT_LOCKED"
  | "TOTP_RECOVERY_USED"
  | "TOTP_DISABLED"
  | "LOGOUT";

/**
 * Write an audit log entry. Fire-and-forget — never blocks the response.
 */
export function auditLog(
  userId: number,
  action: AuditAction,
  detail?: string,
  ipAddress?: string
): void {
  prisma.auditLog
    .create({
      data: {
        userId,
        action,
        detail: detail ?? null,
        ipAddress: ipAddress ?? null,
      },
    })
    .catch((err) => {
      console.error("Audit log write failed:", err);
    });
}

/**
 * Extract client IP from a Request (works behind proxies).
 */
export function getClientIpFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
