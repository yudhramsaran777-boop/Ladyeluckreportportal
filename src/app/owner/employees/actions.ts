"use server";

import { createUserByOwner, type CreateUserByOwnerInput, type CreateUserByOwnerResult } from "@/lib/admin-actions";

export async function createEmployee(
  input: Omit<CreateUserByOwnerInput, "role">
): Promise<CreateUserByOwnerResult> {
  return createUserByOwner({ ...input, role: "employee" });
}
