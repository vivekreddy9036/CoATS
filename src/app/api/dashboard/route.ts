import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireSupervisory } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";

/**
 * GET /api/dashboard
 * Supervisory-only dashboard data.
 * Query params: branchId, dateFrom, dateTo
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const forbidden = requireSupervisory(session);
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Get all branches with case counts per stage
    const branches = await prisma.branch.findMany({
      include: {
        cases: {
          where: { isActive: true },
          select: {
            stage: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    const stages = await prisma.caseStage.findMany({ orderBy: { id: "asc" } });

    const branchSummaries = branches.map((branch) => {
      const branchCases = (branch as unknown as { cases: { stage: { code: string; name: string } }[] }).cases;
      const stageCounts = stages.map((stage) => ({
        stageCode: stage.code,
        stageName: stage.name,
        count: branchCases.filter((c) => c.stage.code === stage.code).length,
      }));

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        stages: stageCounts,
        total: branchCases.length,
      };
    });

    const totalCases = branchSummaries.reduce((sum: number, b: { total: number }) => sum + b.total, 0);

    // Fetch progress entries within date range (if provided)
    let progressEntries = null;
    if (dateFrom && dateTo) {
      const progressWhere: {
        progressDate: { gte: Date; lte: Date };
        case?: { branchId: number };
      } = {
        progressDate: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      };

      if (branchId) {
        progressWhere.case = { branchId: parseInt(branchId, 10) };
      }

      progressEntries = await prisma.caseProgress.findMany({
        where: progressWhere,
        include: {
          case: {
            select: {
              uid: true,
              branch: { select: { name: true } },
              actions: {
                where: { isCompleted: false },
                select: { id: true, description: true },
              },
            },
          },
          createdBy: { select: { fullName: true } },
        },
        orderBy: { progressDate: "desc" },
        take: 100,
      });
    }

    return apiSuccess({
      branches: branchSummaries,
      totalCases,
      progressEntries,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return apiError("Internal server error", 500);
  }
}
