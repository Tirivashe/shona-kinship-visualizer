import { familyRepository } from "@/db/family-repository";

import { familyApiError, readCharacterRequest } from "../../family-api";

interface PersonRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: PersonRouteContext) {
  try {
    const { id } = await context.params;
    const result = await familyRepository.updateCharacter(
      id,
      await readCharacterRequest(request),
    );
    return Response.json(result);
  } catch (cause) {
    return familyApiError(cause);
  }
}

export async function DELETE(_request: Request, context: PersonRouteContext) {
  try {
    const { id } = await context.params;
    return Response.json(await familyRepository.deleteCharacter(id));
  } catch (cause) {
    return familyApiError(cause);
  }
}
