import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import type { UpdateCaseRequest } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]
 * Get case details with actions and progress history.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const caseId = parseInt(id, 10);

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      stage: true,
      branch: true,
      assignedOfficer: { select: { id: true, fullName: true, username: true } },
      createdBy: { select: { id: true, fullName: true } },
      actions: {
        orderBy: { createdAt: "desc" },
      },
      progressEntries: {
        orderBy: { progressDate: "desc" },
        include: {
          createdBy: { select: { fullName: true } },
        },
      },
    },
  });

  if (!caseData) {
    return apiError("Case not found", 404);
  }

  // Case holders can only view their own cases
  if (!session.isSupervisory && caseData.assignedOfficerId !== session.userId) {
    return apiError("Forbidden", 403);
  }

  return apiSuccess(caseData);
}

/**
 * PUT /api/cases/[id]
 * Update case details (limited fields).
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const caseId = parseInt(id, 10);

  const existing = await prisma.case.findUnique({ where: { id: caseId } });

  if (!existing) return apiError("Case not found", 404);

  // Only the assigned officer or supervisory can update
  if (!session.isSupervisory && existing.assignedOfficerId !== session.userId) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as UpdateCaseRequest;

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      ...(body.psLimit !== undefined && { psLimit: body.psLimit }),
      ...(body.sectionOfLaw !== undefined && { sectionOfLaw: body.sectionOfLaw }),
      ...(body.complainantName !== undefined && { complainantName: body.complainantName }),
      ...(body.accusedDetails !== undefined && { accusedDetails: body.accusedDetails }),
      ...(body.gist !== undefined && { gist: body.gist }),
      ...(body.stageId !== undefined && { stageId: body.stageId }),
      ...(body.assignedOfficerId !== undefined && { assignedOfficerId: body.assignedOfficerId }),
    },
    include: { stage: true, branch: true },
  });

  return apiSuccess(updated, "Case updated");
}
