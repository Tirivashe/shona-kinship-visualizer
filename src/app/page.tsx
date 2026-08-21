import FamilyMap from "@/components/FamilyMap";
import { familyRepository } from "@/db/family-repository";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  const initialFamily = await familyRepository.snapshot();

  return (
    <main className="h-screen w-screen bg-neutral-100">
      <FamilyMap initialFamily={initialFamily} />
    </main>
  );
}
