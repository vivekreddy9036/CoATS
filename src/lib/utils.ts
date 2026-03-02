/**
 * Generate a unique case UID.
 * Format: COATS-{BRANCH_CODE}-{YEAR}-{SEQUENCE}
 */
export function generateCaseUid(
  branchCode: string,
  sequence: number
): string {
  const year = new Date().getFullYear();
  const seq = String(sequence).padStart(4, "0");
  return `COATS-${branchCode}-${year}-${seq}`;
}

/**
 * Standard API success response.
 */
export function apiSuccess<T>(data: T, message = "Success") {
  return Response.json({ success: true, message, data }, { status: 200 });
}

/**
 * Standard API created response.
 */
export function apiCreated<T>(data: T, message = "Created successfully") {
  return Response.json({ success: true, message, data }, { status: 201 });
}

/**
 * Standard API error response.
 */
export function apiError(message: string, status = 400) {
  return Response.json({ success: false, message }, { status });
}

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build a paginated response.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
