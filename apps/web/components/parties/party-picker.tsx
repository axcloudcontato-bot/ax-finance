"use client";

import { useState } from "react";
import { PartyQuickAdd } from "./party-quick-add";
import { useSelectAfterCreate } from "@/components/ui/use-select-after-create";

type Party = { id: string; name: string };

/** Seletor opcional de cliente/fornecedor com "+ Novo …" (janela por cima), para formulários do servidor. */
export function PartyPicker({
  id,
  name = "partyId",
  role,
  noun,
  parties,
  defaultValue = "",
}: {
  id: string;
  name?: string;
  role: "CLIENT" | "SUPPLIER";
  noun: "fornecedor" | "cliente" | "estabelecimento";
  parties: Party[];
  defaultValue?: string;
}) {
  const [options, setOptions] = useState(parties);
  const { selectRef, selectCreated } = useSelectAfterCreate(options);
  return (
    <>
      <select ref={selectRef} id={id} name={name} defaultValue={defaultValue}>
        <option value="">Nenhum</option>
        {options.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
      </select>
      <PartyQuickAdd
        role={role}
        noun={noun}
        onCreated={(party) => {
          setOptions((current) => current.some((item) => item.id === party.id) ? current : [...current, party].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
          selectCreated(party.id);
        }}
      />
    </>
  );
}
