import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  return apiSuccess({
    userId: session.userId,
    username: session.username,
    fullName: session.fullName,
    roleCode: session.roleCode,
    isSupervisory: session.isSupervisory,
    branchId: session.branchId,
    branchCode: session.branchCode,
  });
}
