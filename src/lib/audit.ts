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
  | "PASSKEY_REGISTERED"
  | "PASSKEY_AUTH_SUCCESS"
  | "PASSKEY_AUTH_FAILED"
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

export interface LoginGeoResult {
  location: string;   // human-readable place name for display
  lat: number | null;
  lng: number | null;
}

/**
 * Resolve an IP address to coordinates + a human-readable place name.
 * Steps:
 *   1. ipapi.co  → lat/lng + rough city/country fallback (no key, 1000 req/day)
 *   2. Nominatim → precise reverse-geocode: village/suburb/town level (OSM, free)
 * No browser permissions required; done entirely server-side.
 * Returns null location fields on private IPs or any network failure.
 */
export async function lookupIpLocation(ip: string): Promise<LoginGeoResult> {
  const empty: LoginGeoResult = { location: "", lat: null, lng: null };

  if (
    !ip ||
    ip === "unknown" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) {
    return empty;
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let fallbackLocation = "";

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "CoATS/2.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json() as {
        latitude?: number;
        longitude?: number;
        city?: string;
        region?: string;
        country_name?: string;
        error?: boolean;
      };
      if (!data.error) {
        lat = data.latitude ?? null;
        lng = data.longitude ?? null;
        // Fallback label in case Nominatim fails
        const parts = [data.city, data.country_name].filter(Boolean);
        fallbackLocation = parts.join(", ");
      }
    }
  } catch {
    return empty;
  }

  if (lat === null || lng === null) return empty;

  // Nominatim reverse geocoding — zoom=14 gives village/suburb precision
  try {
    const nmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
      {
        headers: { "User-Agent": "CoATS/2.0 location-lookup" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (nmRes.ok) {
      const nm = await nmRes.json() as {
        address?: {
          village?: string;
          suburb?: string;
          town?: string;
          city?: string;
          county?: string;
          state?: string;
          country?: string;
        };
      };
      const a = nm.address;
      if (a) {
        const place = a.village ?? a.suburb ?? a.town ?? a.city ?? a.county ?? "";
        const region = a.state ?? a.country ?? "";
        const label = [place, region].filter(Boolean).join(", ");
        return { location: label || fallbackLocation, lat, lng };
      }
    }
  } catch {
    // Nominatim timed out — fall back to ipapi city
  }

  return { location: fallbackLocation, lat, lng };
}
