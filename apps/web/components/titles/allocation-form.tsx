"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

type Option = { id: string; name: string; parentId?: string | null };
type Initial = { categoryId: string; costCenterId: string | null; amount: string };

export function AllocationForm({ action, clearAction, categories, costCenters, initial, error }: {
  action: (formData: FormData) => void | Promise<void>; clearAction: (formData: FormData) => void | Promise<void>;
  categories: Option[]; costCenters: Option[]; initial: Initial[]; error?: string;
}) {
  const [rows, setRows] = useState<Initial[]>(initial.length >= 2 ? initial : [
    { categoryId: categories[0]?.id ?? "", costCenterId: null, amount: "" },
    { categoryId: categories[0]?.id ?? "", costCenterId: null, amount: "" },
  ]);
  return <>{error ? <p className="error">{error}</p> : null}<form action={action}>
    {rows.map((row, index) => <div className="form-grid" key={index} style={{alignItems:"end",marginBottom:"0.75rem"}}>
      <div><label>Categoria {index + 1}</label><select name={`categoryId-${index}`} value={row.categoryId} onChange={(event) => setRows((current) => current.map((item,i) => i === index ? {...item,categoryId:event.target.value} : item))} required>{categories.map((item) => <option key={item.id} value={item.id}>{item.parentId ? `↳ ${item.name}` : item.name}</option>)}</select></div>
      <div><label>Centro de custo</label><select name={`costCenterId-${index}`} value={row.costCenterId ?? ""} onChange={(event) => setRows((current) => current.map((item,i) => i === index ? {...item,costCenterId:event.target.value || null} : item))}><option value="">Nenhum</option>{costCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div><label>Valor (R$)</label><input name={`amount-${index}`} value={row.amount} onChange={(event) => setRows((current) => current.map((item,i) => i === index ? {...item,amount:event.target.value} : item))} inputMode="decimal" required/></div>
      <button type="button" className="secondary" onClick={() => setRows((current) => current.filter((_,i) => i !== index))} disabled={rows.length <= 2}>Remover</button>
    </div>)}
    <input type="hidden" name="rowCount" value={rows.length}/>
    <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap"}}><button type="button" className="secondary" onClick={() => setRows((current) => [...current,{categoryId:categories[0]?.id ?? "",costCenterId:null,amount:""}])} disabled={rows.length >= 50}>+ Linha</button><SubmitButton>Salvar rateio</SubmitButton>{initial.length ? <SubmitButton formAction={clearAction} className="secondary">Remover rateio</SubmitButton> : null}</div>
  </form></>;
}
