import { NextRequest } from "next/server";
import { getSession, JwtPayload } from "@/lib/auth";
import { apiError } from "@/lib/utils";

/**
 * Middleware helper — extracts and validates the session from cookies.
 * Returns the session payload or a 401 Response.
 */
export async function requireAuth(
  _req: NextRequest
): Promise<JwtPayload | Response> {
  const session = await getSession();
  if (!session) {
    return apiError("Unauthorized", 401);
  }
  return session;
}

/**
 * Checks that the session belongs to a supervisory officer.
 */
export function requireSupervisory(session: JwtPayload): Response | null {
  if (!session.isSupervisory) {
    return apiError("Forbidden — supervisory access required", 403);
  }
  return null;
}
