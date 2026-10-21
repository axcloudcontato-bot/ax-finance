"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ModalHeader } from "@/components/ui/modal-header";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, Landmark } from "@/components/ui/animated-icons";
import { CategorySuggestion } from "@/components/category-suggestion";
import { CategoryQuickAdd } from "@/components/categories/category-quick-add";
import { withCategory } from "@/components/categories/category-picker";
import { PartyQuickAdd } from "@/components/parties/party-quick-add";
import { useSelectAfterCreate } from "@/components/ui/use-select-after-create";
import { TransferForm } from "@/components/transfers/transfer-form";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import { useModalPresence } from "@/components/ui/use-modal-presence";
import { todayDateOnlyString } from "@/lib/dates";
import {
  loadQuickCreateOptionsAction,
  quickCreateTitleAction,
  quickCreateTransferAction,
  type QuickCreateKind,
  type QuickCreateOptions,
} from "@/app/(app)/quick-create-actions";

const OPEN_EVENT = "ax:quick-create";
const FLASH_EVENT = "ax:flash";

/** Abre o modal de criação rápida sobre a tela atual (usado pelo "+" do menu e pelos atalhos do dashboard). */
export function openQuickCreate(kind: QuickCreateKind) {
  window.dispatchEvent(new CustomEvent<QuickCreateKind>(OPEN_EVENT, { detail: kind }));
}

/** Mensagem curta no cartão do canto inferior direito (mostrada pelo NotificationToasts). */
function flash(message: string) {
  window.dispatchEvent(new CustomEvent<string>(FLASH_EVENT, { detail: message }));
}

/** Gatilho para colocar em qualquer tela (ex.: cartões de lançamento rápido do dashboard). */
export function QuickCreateButton({ kind, className, children }: { kind: QuickCreateKind; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className ?? "button-link"} onClick={() => openQuickCreate(kind)}>
      {children}
    </button>
  );
}

const TITLES: Record<QuickCreateKind, { title: string; icon: ReactNode }> = {
  RECEIVABLE: { title: "Nova entrada", icon: <ArrowDownCircle className="size-5" strokeWidth={1.5} /> },
  PAYABLE: { title: "Nova saída", icon: <ArrowUpCircle className="size-5" strokeWidth={1.5} /> },
  TRANSFER: { title: "Nova transferência", icon: <Landmark className="size-5" strokeWidth={1.5} /> },
};

export function QuickCreateModal() {
  const router = useRouter();
  const [kind, setKind] = useState<QuickCreateKind | null>(null);
  // Continua mostrando o último formulário enquanto o modal encolhe de volta ao fechar.
  const [shownKind, setShownKind] = useState<QuickCreateKind | null>(null);
  const [options, setOptions] = useState<QuickCreateOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Muda a cada "Salvar e nova": remonta o formulário limpo e com outra chave de idempotência.
  const [round, setRound] = useState(0);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Quem abriu (o "+" do topo, um atalho...): o modal cresce a partir dele.
  const originRef = useRef<HTMLElement | null>(null);
  const mounted = useModalPresence(kind !== null, originRef, dialogRef, overlayRef);

  const close = useCallback(() => setKind(null), []);
  const setOpen = useCallback((open: boolean) => { if (!open) setKind(null); }, []);
  useModalFocus(kind !== null && options !== null, setOpen, triggerRef, dialogRef);

  useEffect(() => {
    const onOpen = (event: Event) => {
      originRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      triggerRef.current = originRef.current instanceof HTMLButtonElement ? originRef.current : null;
      setOptions(null);
      setLoadError(null);
      setRound((value) => value + 1);
      setShownKind((event as CustomEvent<QuickCreateKind>).detail);
      setKind((event as CustomEvent<QuickCreateKind>).detail);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    void loadQuickCreateOptionsAction(kind)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setOptions(result.options);
        else setLoadError(result.error);
      })
      .catch(() => { if (!cancelled) setLoadError("Não foi possível carregar o formulário."); });
    return () => { cancelled = true; };
  }, [kind]);

  // Sem dados ainda (ou com falha) o foco/Esc não passam pelo hook: Esc fecha direto.
  useEffect(() => {
    if (!kind || options) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [kind, options, close]);

  if (!mounted || !shownKind) return null;
  const { title, icon } = TITLES[shownKind];

  function done(message: string, keepOpen: boolean) {
    flash(message);
    if (keepOpen) setRound((value) => value + 1);
    else close();
    // A tela atual é recarregada com os dados novos, sem sair dela.
    router.refresh();
  }

  return (
    <div ref={overlayRef} className="modal-overlay" onClick={close}>
      <div
        ref={dialogRef}
        className={`modal-dialog ${shownKind !== "TRANSFER" ? "quick-title-dialog" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: shownKind === "TRANSFER" ? "620px" : "720px" }}
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader title={title} titleId={titleId} icon={icon} onClose={close} />

        {loadError ? <p className="error">{loadError}</p> : null}
        {!options && !loadError ? <p className="muted" aria-live="polite">Carregando…</p> : null}
        {options && shownKind === "TRANSFER" ? (
          <QuickTransfer key={round} accounts={options.accounts} onDone={done} onCancel={close} />
        ) : null}
        {options && shownKind !== "TRANSFER" ? (
          <QuickTitle key={`${shownKind}-${round}`} kind={shownKind} options={options} onCancel={close} onDone={done} onCategoryCreated={(category) => setOptions((current) => current ? { ...current, categories: withCategory(current.categories, category) } : current)} onPartyCreated={(party) => setOptions((current) => current && !current.parties.some((item) => item.id === party.id) ? { ...current, parties: [...current.parties, party].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) } : current)} />
        ) : null}
      </div>
    </div>
  );
}

type QuickCategory = QuickCreateOptions["categories"][number];

function QuickTitle({ kind, options, onCancel, onDone, onCategoryCreated, onPartyCreated }: { kind: "RECEIVABLE" | "PAYABLE"; options: QuickCreateOptions; onCancel: () => void; onDone: (message: string, keepOpen: boolean) => void; onCategoryCreated: (category: QuickCategory) => void; onPartyCreated: (party: QuickCreateOptions["parties"][number]) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const confirmDuplicate = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error || duplicate) feedbackRef.current?.focus();
  }, [error, duplicate]);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const today = todayDateOnlyString();
  const keepOpen = useRef(false);
  // Categoria/pessoa criada pelo "+ Novo": quando aparece na lista, já fica escolhida.
  const { selectRef: categoryRef, selectCreated: selectCategory } = useSelectAfterCreate(options.categories);
  const { selectRef: partyRef, selectCreated: selectParty } = useSelectAfterCreate(options.parties);
  const partyLabel = kind === "RECEIVABLE" ? "Cliente" : "Fornecedor";

  async function submit(formData: FormData) {
    setError(null);
    setDuplicate(false);
    if (confirmDuplicate.current) formData.set("confirmDuplicate", "1");
    const result = await quickCreateTitleAction(kind, formData);
    if (result.ok) onDone(result.message, keepOpen.current);
    else if (result.duplicate) setDuplicate(true);
    else setError(result.error);
    confirmDuplicate.current = false;
  }

  // Envio por onSubmit (e não por action): o React limpa os campos de um <form action> quando a ação termina,
  // e aqui a pessoa precisa manter o que digitou se houver erro ou aviso de duplicidade.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    keepOpen.current = submitter instanceof HTMLButtonElement && submitter.dataset.keepOpen === "true";
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await submit(formData);
    });
  }

  // Aviso de duplicidade: se a pessoa confirmar que é outro lançamento, reenvia o mesmo formulário.
  function submitAnyway() {
    confirmDuplicate.current = true;
    keepOpen.current = false;
    formRef.current?.requestSubmit();
  }

  return (
    <form className="quick-title-form" ref={formRef} onSubmit={onSubmit} onChange={() => { if (duplicate) setDuplicate(false); }}>
      <div className="quick-title-body">
      <div ref={feedbackRef} tabIndex={-1}>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {duplicate ? (
        <div className="duplicate-warning" role="alert">
          <strong>Possível lançamento em duplicidade</strong>
          <p>Já existe um {kind === "RECEIVABLE" ? "recebimento" : "pagamento"} com o mesmo valor, vencimento próximo e {options.parties.length > 0 ? "a mesma pessoa ou descrição" : "a mesma descrição"}. Confira a lista antes de lançar de novo.</p>
          <button type="button" className="secondary" disabled={pending} onClick={submitAnyway}>É outro lançamento, lançar mesmo assim</button>
        </div>
      ) : null}
      </div>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="form-grid">
        <div className="span-2">
          <label htmlFor="qc-description">Descrição</label>
          <input id="qc-description" name="description" type="text" required maxLength={500} autoFocus />
        </div>

        <div>
          <label htmlFor="qc-category">Categoria</label>
          <select ref={categoryRef} id="qc-category" name="categoryId" required defaultValue="">
            <option value="" disabled>Selecione</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.parentId ? `  ↳ ${category.name}` : category.name}</option>
            ))}
          </select>
          {options.categories.length === 0 ? <small className="muted">Nenhuma categoria ainda: crie a primeira aqui embaixo.</small> : null}
          <CategorySuggestion type={kind} />
          <CategoryQuickAdd
            kind={kind}
            parents={options.categories.filter((category) => !category.parentId)}
            onCreated={(category) => { onCategoryCreated(category); selectCategory(category.id); }}
          />
        </div>

        <div>
          <label htmlFor="qc-party">{partyLabel} (opcional)</label>
          <select ref={partyRef} id="qc-party" name="partyId" defaultValue="">
            <option value="">Nenhum</option>
            {options.parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
          </select>
          <PartyQuickAdd
            role={kind === "RECEIVABLE" ? "CLIENT" : "SUPPLIER"}
            noun={kind === "RECEIVABLE" ? "cliente" : "fornecedor"}
            onCreated={(party) => { onPartyCreated(party); selectParty(party.id); }}
          />
        </div>

        {options.costCenters.length > 0 ? (
          <div>
            <label htmlFor="qc-cost-center">Centro de custo (opcional)</label>
            <select id="qc-cost-center" name="costCenterId" defaultValue="">
              <option value="">Nenhum</option>
              {options.costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
          </div>
        ) : null}

        <div className={options.costCenters.length ? undefined : "span-2"}>
          <label htmlFor="qc-amount">Valor (R$)</label>
          <input id="qc-amount" name="amount" type="text" inputMode="decimal" placeholder="0,00" required />
        </div>

        <div>
          <label htmlFor="qc-competence">Competência</label>
          <input id="qc-competence" name="competenceDate" type="date" defaultValue={today} required />
        </div>

        <div>
          <label htmlFor="qc-due">Vencimento</label>
          <input id="qc-due" name="dueDate" type="date" defaultValue={today} required />
        </div>

        <div className="span-2">
          <label htmlFor="qc-notes">Observações</label>
          <input id="qc-notes" name="notes" type="text" maxLength={2000} />
        </div>
      </div>

      <details className="quick-more">
        <summary>Mais detalhes (opcional)</summary>
        <div className="form-grid">
          <div>
            <label htmlFor="qc-account">{kind === "RECEIVABLE" ? "Conta prevista para receber" : "Conta prevista para pagar"}</label>
            <select id="qc-account" name="expectedAccountId" defaultValue="">
              <option value="">Não informar</option>
              {options.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="qc-method">Forma de pagamento prevista</label>
            <select id="qc-method" name="expectedPaymentMethod" defaultValue="">
              <option value="">Não informar</option>
              {options.paymentMethods.map((method) => <option key={method.key} value={method.key}>{method.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="qc-document">Nº do documento (nota, boleto, pedido)</label>
            <input id="qc-document" name="documentNumber" type="text" maxLength={60} />
          </div>
          <div>
            <label htmlFor="qc-code">{kind === "PAYABLE" ? "Linha digitável ou chave PIX" : "Chave PIX ou dados para receber"}</label>
            <input id="qc-code" name="paymentCode" type="text" maxLength={200} />
          </div>
        </div>
      </details>

      </div>
      <div className="quick-title-footer">
        <button type="button" className="secondary" disabled={pending} onClick={onCancel}>Cancelar</button>
        <button type="submit" className="workspace-primary-action" disabled={pending}>{pending ? "Salvando…" : kind === "RECEIVABLE" ? "Salvar entrada" : "Salvar saída"}</button>
        <button type="submit" className="secondary" data-keep-open="true" disabled={pending}>Salvar e criar outra</button>
      </div>
    </form>
  );
}

function QuickTransfer({ accounts, onDone, onCancel }: { accounts: { id: string; name: string }[]; onDone: (message: string, keepOpen: boolean) => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (accounts.length < 2) {
    return (
      <div className="workspace-empty">
        <strong>Falta uma segunda conta</strong>
        <p>Cadastre pelo menos duas contas ativas para registrar uma transferência interna.</p>
        <Link href="/contas" className="button-link" onClick={onCancel}>Ir para Contas</Link>
      </div>
    );
  }

  return (
    <>
      <p className="workspace-method-note">Transferências internas não são receita nem despesa. Apenas a tarifa reduz o saldo total da empresa.</p>
      {error ? <p className="error">{error}</p> : null}
      <TransferForm
        accounts={accounts}
        today={todayDateOnlyString()}
        idempotencyKey={idempotencyKey}
        onCancel={onCancel}
        action={async (formData) => {
          setError(null);
          const result = await quickCreateTransferAction(formData);
          if (result.ok) onDone(result.message, false);
          else setError(result.error);
        }}
      />
    </>
  );
}

/** Compatibilidade com endereços antigos (`?novo=1`): abre a criação rápida e tira o parâmetro da URL. */
export function QuickCreateOnParam({ kind, param = "novo" }: { kind: QuickCreateKind; param?: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!searchParams.has(param)) return;
    openQuickCreate(kind);
    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    router.replace(next.size > 0 ? `${pathname}?${next.toString()}` : pathname);
    // Só na chegada à página com o parâmetro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
