import { apiSuccess } from "@/lib/utils";
import { getTokenName } from "@/lib/auth";

export async function POST() {
  const response = apiSuccess(null, "Logged out");
  response.headers.set(
    "Set-Cookie",
    `${getTokenName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return response;
}
