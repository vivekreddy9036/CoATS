import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { lastLoginLocation: true, lastLoginIp: true, lastLoginLat: true, lastLoginLng: true },
  });

  return apiSuccess({
    userId: session.userId,
    username: session.username,
    fullName: session.fullName,
    roleCode: session.roleCode,
    isSupervisory: session.isSupervisory,
    branchId: session.branchId,
    branchCode: session.branchCode,
    lastLoginLocation: user?.lastLoginLocation ?? null,
    lastLoginIp: user?.lastLoginIp ?? null,
    lastLoginLat: user?.lastLoginLat ?? null,
    lastLoginLng: user?.lastLoginLng ?? null,
  });
}
