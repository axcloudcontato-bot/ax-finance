import { randomUUID } from "node:crypto";
import type { listActiveCategories, listCostCenters, listFinancialAccounts, listTitles } from "@ax-finance/domain";
import { formatCents } from "@/lib/currency";
import { formatDateOnly, todayDateOnlyString } from "@/lib/dates";

type Title = Awaited<ReturnType<typeof listTitles>>[number];
type Category = Awaited<ReturnType<typeof listActiveCategories>>[number];
type Account = Awaited<ReturnType<typeof listFinancialAccounts>>[number];
type Center = Awaited<ReturnType<typeof listCostCenters>>[number];

export function TitleBatchPreview({ titles, categories, accounts, costCenters, action, error, noun }: { titles: Title[]; categories: Category[]; accounts: Account[]; costCenters: Center[]; action:(formData:FormData)=>void|Promise<void>; error?:string; noun:string }) {
  const hidden = titles.map((title)=><input key={title.id} type="hidden" name="titleId" value={title.id}/>);
  const total = titles.reduce((sum,title)=>sum+title.remainingCents,BigInt(0));
  return <>
    {error?<p className="error">{error}</p>:null}
    <div className="card"><h1>Pré-visualização</h1><p className="subtitle">Confira os {titles.length} {noun}(s) selecionados. Nenhuma alteração foi feita ainda.</p><table><thead><tr><th>Descrição</th><th>Vencimento</th><th>Categoria atual</th><th>Saldo aberto</th></tr></thead><tbody>{titles.map((title)=><tr key={title.id}><td>{title.description}</td><td>{formatDateOnly(title.dueDate)}</td><td>{title.category.name}</td><td>{formatCents(title.remainingCents)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>Total em aberto</th><th>{formatCents(total)}</th></tr></tfoot></table></div>
    <div className="split">
      <div className="card"><h1>Baixa integral</h1><p className="subtitle">Liquida o saldo aberto de todos os títulos na conta e data informadas.</p><form action={action}>{hidden}<input type="hidden" name="operation" value="SETTLE_FULL"/><input type="hidden" name="idempotencyKey" value={randomUUID()}/><label>Conta</label><select name="financialAccountId" required defaultValue=""><option value="" disabled>Selecione</option>{accounts.filter((item)=>item.status==="ACTIVE").map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><label>Data efetiva</label><input name="effectiveDate" type="date" defaultValue={todayDateOnlyString()} required/><button type="submit">Confirmar baixas</button></form></div>
      <div className="card"><h1>Reclassificar</h1><p className="subtitle">Aplica a mesma categoria e centro de custo a toda a seleção.</p><form action={action}>{hidden}<input type="hidden" name="operation" value="CLASSIFY"/><label>Categoria</label><select name="categoryId" required defaultValue=""><option value="" disabled>Selecione</option>{categories.map((item)=><option key={item.id} value={item.id}>{item.parentId?`↳ ${item.name}`:item.name}</option>)}</select><label>Centro de custo</label><select name="costCenterId" defaultValue=""><option value="">Nenhum</option>{costCenters.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="submit">Confirmar reclassificação</button></form></div>
      <div className="card"><h1>Cancelar</h1><p className="subtitle">Disponível somente quando nenhum título selecionado possui baixa ativa.</p><form action={action}>{hidden}<input type="hidden" name="operation" value="CANCEL"/><label>Motivo</label><input name="reason" required maxLength={500}/><button type="submit" className="secondary">Confirmar cancelamento</button></form></div>
    </div>
  </>;
}
