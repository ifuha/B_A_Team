// src/lib/year-guard.ts
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { yearConfirmation } from "@/src/db/schema";

export async function isYearConfirmed(year: number): Promise<boolean> {
  const [row] = await db
    .select()
    .from(yearConfirmation)
    .where(eq(yearConfirmation.year, year));
  return !!row?.isConfirmed;
}
