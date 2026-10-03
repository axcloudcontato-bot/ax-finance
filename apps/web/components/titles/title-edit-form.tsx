import type { listActiveCategories, listCostCenters, listParties } from "@ax-finance/domain";
import { toDateOnlyString } from "@/lib/dates";
import { SubmitButton } from "@/components/ui/submit-button";

type Category = Awaited<ReturnType<typeof listActiveCategories>>[number];
type Party = Awaited<ReturnType<typeof listParties>>[number];
type CostCenter = Awaited<ReturnType<typeof listCostCenters>>[number];

export function TitleEditForm({ action, title, categories, parties, costCenters, partyLabel, error }: {
  action: (formData: FormData) => void | Promise<void>;
  title: { description: string; categoryId: string; partyId: string | null; costCenterId: string | null; originalAmountCents: bigint; competenceDate: Date; dueDate: Date; notes: string | null };
  categories: Category[]; parties: Party[]; costCenters: CostCenter[]; partyLabel: string; error?: string;
}) {
  const amount = (Number(title.originalAmountCents) / 100).toFixed(2).replace(".", ",");
  return <>{error ? <p className="error">{error}</p> : null}<form action={action}>
    <div className="form-grid">
      <div className="span-2"><label htmlFor="edit-description">Descrição</label><input id="edit-description" name="description" defaultValue={title.description} required maxLength={500}/></div>
      <div><label htmlFor="edit-category">Categoria</label><select id="edit-category" name="categoryId" defaultValue={title.categoryId} required>{categories.map((item) => <option key={item.id} value={item.id}>{item.parentId ? `↳ ${item.name}` : item.name}</option>)}</select></div>
      <div><label htmlFor="edit-party">{partyLabel}</label><select id="edit-party" name="partyId" defaultValue={title.partyId ?? ""}><option value="">Nenhum</option>{parties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label htmlFor="edit-center">Centro de custo</label><select id="edit-center" name="costCenterId" defaultValue={title.costCenterId ?? ""}><option value="">Nenhum</option>{costCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label htmlFor="edit-amount">Valor (R$)</label><input id="edit-amount" name="amount" inputMode="decimal" defaultValue={amount} required/></div>
      <div><label htmlFor="edit-competence">Competência</label><input id="edit-competence" name="competenceDate" type="date" defaultValue={toDateOnlyString(title.competenceDate)} required/></div>
      <div><label htmlFor="edit-due">Vencimento</label><input id="edit-due" name="dueDate" type="date" defaultValue={toDateOnlyString(title.dueDate)} required/></div>
      <div className="span-2"><label htmlFor="edit-title-notes">Observações</label><textarea id="edit-title-notes" name="notes" defaultValue={title.notes ?? ""} maxLength={2000}/></div>
    </div><SubmitButton>Salvar alterações</SubmitButton>
  </form></>;
}
