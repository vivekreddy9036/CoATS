import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/actions/[id]/complete
 * Mark a single action as completed.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const actionId = parseInt(id, 10);

  const action = await prisma.caseAction.findUnique({
    where: { id: actionId },
    include: { case: true },
  });

  if (!action) return apiError("Action not found", 404);

  // Only the assigned officer or supervisory can complete actions
  if (
    !session.isSupervisory &&
    action.case.assignedOfficerId !== session.userId
  ) {
    return apiError("Forbidden", 403);
  }

  if (action.isCompleted) {
    return apiError("Action already completed");
  }

  const updated = await prisma.caseAction.update({
    where: { id: actionId },
    data: { isCompleted: true, completedAt: new Date() },
  });

  return apiSuccess(updated, "Action completed");
}
