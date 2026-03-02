import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, getTokenName } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";
import type { LoginRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginRequest;

    if (!body.username || !body.password) {
      return apiError("Username and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { username: body.username.toUpperCase().trim() },
      include: { role: true, branch: true },
    });

    if (!user || !user.isActive) {
      return apiError("Invalid credentials", 401);
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return apiError("Invalid credentials", 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = await signToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleCode: user.role.code,
      isSupervisory: user.role.isSupervisory,
      branchId: user.branchId,
      branchCode: user.branch.code,
    });

    const response = apiSuccess({
      user: {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        roleCode: user.role.code,
        isSupervisory: user.role.isSupervisory,
        branchId: user.branchId,
        branchCode: user.branch.code,
      },
    }, "Login successful");

    // Set HTTP-only cookie
    response.headers.set(
      "Set-Cookie",
      `${getTokenName()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${8 * 3600}`
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Internal server error", 500);
  }
}
