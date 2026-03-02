import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  buildAccessCookie,
  buildRefreshCookie,
} from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { applyRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit";
import type { LoginRequest } from "@/types";

async function verifyTurnstile(token: string): Promise<boolean> {
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
      }),
    }
  );
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 5 login attempts per 60s per IP ──
    const rateLimited = applyRateLimit(req, LOGIN_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = (await req.json()) as LoginRequest;

    if (!body.username || !body.password) {
      return apiError("Username and password are required");
    }

    if (!body.turnstileToken) {
      return apiError("CAPTCHA verification required", 400);
    }

    const captchaOk = await verifyTurnstile(body.turnstileToken);
    if (!captchaOk) {
      return apiError("CAPTCHA verification failed. Please try again.", 400);
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

    const jwtPayload = {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleCode: user.role.code,
      isSupervisory: user.role.isSupervisory,
      branchId: user.branchId,
      branchCode: user.branch.code,
    };

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(jwtPayload),
      signRefreshToken(user.id),
    ]);

    const response = apiSuccess(
      {
        user: {
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          roleCode: user.role.code,
          isSupervisory: user.role.isSupervisory,
          branchId: user.branchId,
          branchCode: user.branch.code,
        },
      },
      "Login successful"
    );

    // Set HttpOnly cookies (access + refresh)
    response.headers.append("Set-Cookie", buildAccessCookie(accessToken));
    response.headers.append("Set-Cookie", buildRefreshCookie(refreshToken));

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Internal server error", 500);
  }
}
