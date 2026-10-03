"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCompanyInvitation,
  deleteImportSource,
  revokeCompanyInvitation,
  resetCompanyLedger,
  revokeCompanyMember,
  transferCompanyOwnership,
  updateCompanyMemberAccess,
  updateCompanyMemberRole,
} from "@ax-finance/domain";
import { requirePrimaryCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/session";
import { emailPreviewEnabled } from "@/lib/email";
import { deleteAttachmentObject } from "@/lib/attachment-storage";

export interface InviteUserState {
  error?: string;
  invitePath?: string;
  emailQueued?: boolean;
}

export async function inviteUserAction(
  _previousState: InviteUserState,
  formData: FormData
): Promise<InviteUserState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };
  const company = await requirePrimaryCompany(user.id);

  try {
    const { rawToken } = await createCompanyInvitation(user.id, company.id, {
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "VIEWER"),
    });
    revalidatePath("/configuracoes/usuarios");
    return {
      emailQueued: true,
      invitePath: emailPreviewEnabled() ? `/convites/${rawToken}` : undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o convite." };
  }
}

export async function revokeInvitationAction(invitationId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await revokeCompanyInvitation(user.id, company.id, invitationId);
  } catch (error) {
    redirect(`/configuracoes/usuarios?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao revogar convite.")}`);
  }
  revalidatePath("/configuracoes/usuarios");
  redirect("/configuracoes/usuarios?atualizado=1");
}

export async function updateMemberRoleAction(membershipId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await updateCompanyMemberRole(user.id, company.id, membershipId, {
      role: String(formData.get("role") ?? "VIEWER"),
    });
  } catch (error) {
    redirect(`/configuracoes/usuarios?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao alterar papel.")}`);
  }
  revalidatePath("/configuracoes/usuarios");
  redirect("/configuracoes/usuarios?atualizado=1");
}

export async function revokeMemberAction(membershipId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await revokeCompanyMember(user.id, company.id, membershipId);
  } catch (error) {
    redirect(`/configuracoes/usuarios?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao revogar acesso.")}`);
  }
  revalidatePath("/configuracoes/usuarios");
  redirect("/configuracoes/usuarios?atualizado=1");
}

export async function updateMemberAccessAction(membershipId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    await updateCompanyMemberAccess(user.id, company.id, membershipId, {
      accessScope: String(formData.get("accessScope") ?? "ALL"),
      financialAccountIds: formData.getAll("financialAccountIds").map(String),
      costCenterIds: formData.getAll("costCenterIds").map(String),
    });
  } catch (error) {
    redirect(`/configuracoes/usuarios?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao atualizar restrições.")}`);
  }
  revalidatePath("/configuracoes/usuarios");
  redirect("/configuracoes/usuarios?atualizado=1");
}

export async function transferOwnershipAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  try {
    if (String(formData.get("confirmation") ?? "") !== "TRANSFERIR") {
      throw new Error("Digite TRANSFERIR para confirmar a mudança de proprietário.");
    }
    await transferCompanyOwnership(user.id, company.id, String(formData.get("membershipId") ?? ""));
  } catch (error) {
    redirect(`/configuracoes/usuarios?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao transferir a propriedade.")}`);
  }
  revalidatePath("/configuracoes/usuarios");
  redirect("/dashboard?propriedadeTransferida=1");
}

export async function resetCompanyLedgerAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await requirePrimaryCompany(user.id);
  let files;
  try {
    ({ files } = await resetCompanyLedger(user.id, company.id, { confirmation: String(formData.get("confirmation") ?? "") }));
  } catch (error) {
    redirect(`/configuracoes/usuarios?erro=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao zerar os lançamentos.")}`);
  }
  // Os registros já foram apagados no banco; agora some também o conteúdo dos arquivos.
  // Falha aqui não desfaz o reset, só deixa arquivo órfão no storage.
  await Promise.allSettled([
    ...files.attachments.map((attachment) => deleteAttachmentObject(attachment.storageKey, attachment.storageBackend)),
    ...files.imports.map((storageKey) => deleteImportSource(storageKey)),
  ]);
  revalidatePath("/", "layout");
  redirect("/configuracoes/usuarios?zerado=1");
}
