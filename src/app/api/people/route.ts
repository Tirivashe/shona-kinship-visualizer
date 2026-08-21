import { familyRepository } from "@/db/family-repository";

import { familyApiError, readCharacterRequest } from "../family-api";

export async function POST(request: Request) {
  try {
    const result = await familyRepository.addCharacter(
      await readCharacterRequest(request),
    );
    return Response.json(result, { status: 201 });
  } catch (cause) {
    return familyApiError(cause);
  }
}
