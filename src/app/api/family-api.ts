import "server-only";

import { FamilyDataError } from "@/data/in-memory-family-database";
import { parseNewCharacterInput } from "@/data/family-input";

const MAX_CHARACTER_REQUEST_BYTES = 8 * 1024 * 1024;

export async function readCharacterRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new FamilyDataError("Content-Type must be application/json.");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_CHARACTER_REQUEST_BYTES
  ) {
    throw new FamilyDataError("The character payload is too large.");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_CHARACTER_REQUEST_BYTES) {
    throw new FamilyDataError("The character payload is too large.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new FamilyDataError("The request body is not valid JSON.");
  }
  return parseNewCharacterInput(payload);
}

export function familyApiError(cause: unknown) {
  if (cause instanceof FamilyDataError) {
    return Response.json(
      { error: cause.message },
      { status: cause.code === "NOT_FOUND" ? 404 : 400 },
    );
  }

  console.error("Unexpected family database error", cause);
  return Response.json(
    { error: "The family database operation failed." },
    { status: 500 },
  );
}
