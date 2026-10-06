"use server";

import { redirect } from "next/navigation";
import { createParty, deactivateParty, reactivateParty, updateParty } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { actionErrorMessage } from "@/lib/action-errors";

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

  let party: Awaited<ReturnType<typeof createParty>>;
  try {
    party = await createParty(user.id, company.id, {
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
    const message = actionErrorMessage(error, "Não foi possível criar a pessoa.");
    redirect(`/cadastros/pessoas?erro=${encodeURIComponent(message)}`);
  }

  redirect(`/cadastros/pessoas?criado=${party.id}`);
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

function partyFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""), tradeName: String(formData.get("tradeName") ?? "") || undefined,
    document: String(formData.get("document") ?? "") || undefined, email: String(formData.get("email") ?? "") || undefined,
    phone: String(formData.get("phone") ?? "") || undefined, address: String(formData.get("address") ?? "") || undefined,
    responsibleName: String(formData.get("responsibleName") ?? "") || undefined, notes: String(formData.get("notes") ?? "") || undefined,
    isClient: formData.get("isClient") === "true", isSupplier: formData.get("isSupplier") === "true",
  };
}

export async function updatePartyAction(partyId: string, formData: FormData) {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try { await updateParty(user.id, company.id, partyId, partyFormData(formData)); }
  catch (error) { redirect(`/cadastros/pessoas/${partyId}?erro=${encodeURIComponent(actionErrorMessage(error, "Não foi possível editar a pessoa."))}`); }
  redirect(`/cadastros/pessoas/${partyId}?atualizado=1`);
}

export async function reactivatePartyAction(partyId: string) {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  await reactivateParty(user.id, company.id, partyId);
  redirect(`/cadastros/pessoas/${partyId}`);
}
