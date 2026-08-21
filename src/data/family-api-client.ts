import type {
  FamilySnapshot,
  NewCharacterInput,
} from "./in-memory-family-database";
import type { Person } from "@/types/family";

interface FamilyMutationResponse {
  person: Person;
  family: FamilySnapshot;
}

async function familyRequest<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(
      "Unable to reach the family database. Check your connection and try again.",
    );
  }
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "The family database operation failed.";
    throw new Error(error);
  }

  return payload as T;
}

export function addFamilyPerson(input: NewCharacterInput) {
  return familyRequest<FamilyMutationResponse>("/api/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateFamilyPerson(
  personId: string,
  input: NewCharacterInput,
) {
  return familyRequest<FamilyMutationResponse>(
    `/api/people/${encodeURIComponent(personId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function deleteFamilyPerson(personId: string) {
  return familyRequest<FamilyMutationResponse>(
    `/api/people/${encodeURIComponent(personId)}`,
    { method: "DELETE" },
  );
}
