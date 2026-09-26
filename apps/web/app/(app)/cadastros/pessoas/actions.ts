"use server";

import { redirect } from "next/navigation";
import { createParty, deactivateParty } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";

export async function createPartyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const name = String(formData.get("name") ?? "");
  const tradeName = String(formData.get("tradeName") ?? "") || undefined;
  const document = String(formData.get("document") ?? "") || undefined;
  const email = String(formData.get("email") ?? "") || undefined;
  const phone = String(formData.get("phone") ?? "") || undefined;
  const address = String(formData.get("address") ?? "") || undefined;
  const responsibleName = String(formData.get("responsibleName") ?? "") || undefined;
  const notes = String(formData.get("notes") ?? "") || undefined;
  const isClient = formData.get("isClient") === "true";
  const isSupplier = formData.get("isSupplier") === "true";

  try {
    await createParty(user.id, company.id, {
      name,
      tradeName,
      document,
      email,
      phone,
      address,
      responsibleName,
      notes,
      isClient,
      isSupplier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a pessoa.";
    redirect(`/cadastros/pessoas?erro=${encodeURIComponent(message)}`);
  }

  redirect("/cadastros/pessoas");
}

export async function deactivatePartyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);
  const partyId = String(formData.get("partyId") ?? "");

  await deactivateParty(user.id, company.id, partyId);

  redirect(`/cadastros/pessoas/${partyId}`);
}
