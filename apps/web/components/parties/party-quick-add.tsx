"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Store, UserRoundPlus } from "lucide-react";
import { StackedModal } from "@/components/ui/stacked-modal";
import { quickCreatePartyAction } from "@/app/(app)/quick-create-actions";

type Party = { id: string; name: string };

/**
 * "+ Novo fornecedor/cliente/estabelecimento" embaixo do seletor: janela por cima do lançamento com
 * nome e CPF/CNPJ opcional. Criado, volta por `onCreated` para já ficar escolhido.
 */
export function PartyQuickAdd({
  role,
  noun,
  onCreated,
}: {
  role: "CLIENT" | "SUPPLIER";
  /** Como a tela chama o cadastro: "fornecedor", "cliente", "estabelecimento". */
  noun: "fornecedor" | "cliente" | "estabelecimento";
  onCreated: (party: Party) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const title = `Novo ${noun}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A janela está fora do formulário de baixo, mas o evento do React ainda subiria até ele.
    event.stopPropagation();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError("Informe o nome.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await quickCreatePartyAction(role, { name, document: String(data.get("document") ?? "").trim() || undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.party);
      setOpen(false);
    });
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="inline-add-toggle" onClick={() => { setError(null); setOpen(true); }}>
        + {title}
      </button>
      <StackedModal
        open={open}
        onClose={() => { if (!pending) setOpen(false); }}
        originRef={triggerRef}
        title={title}
        icon={noun === "estabelecimento" ? <Store strokeWidth={1.8} /> : <UserRoundPlus strokeWidth={1.8} />}
      >
        <form onSubmit={submit} noValidate className="stacked-modal-form">
          {error ? <p className="error" role="alert">{error}</p> : null}
          <label htmlFor={`${id}-nome`}>Nome</label>
          <input
            id={`${id}-nome`}
            name="name"
            type="text"
            maxLength={200}
            required
            autoComplete="off"
            placeholder={noun === "estabelecimento" ? "Ex.: Supermercado Bom Preço, Posto Shell" : noun === "cliente" ? "Ex.: Maria Silva, Empresa ABC" : "Ex.: Copel, Imobiliária Centro"}
          />
          <label htmlFor={`${id}-documento`}>CPF ou CNPJ (opcional)</label>
          <input id={`${id}-documento`} name="document" type="text" inputMode="numeric" maxLength={30} autoComplete="off" />
          <p className="stacked-modal-hint">Endereço, contato e outros dados podem ser completados depois em Cadastros &gt; Clientes e fornecedores.</p>
          <div className="stacked-modal-actions">
            <button type="button" className="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" disabled={pending}>{pending ? "Salvando…" : `Cadastrar ${noun}`}</button>
          </div>
        </form>
      </StackedModal>
    </>
  );
}
