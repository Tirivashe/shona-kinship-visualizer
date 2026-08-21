import { familyRepository } from "@/db/family-repository";

import { familyApiError } from "../family-api";

export async function GET() {
  try {
    return Response.json(await familyRepository.snapshot());
  } catch (cause) {
    return familyApiError(cause);
  }
}
