"use client";

import type { ReactNode } from "react";
import {
  Archive, ArchiveRestore, ArrowLeftRight, Ban, CalendarClock, CalendarRange, CircleCheck, CircleHelp, Copy, FileText,
  HandCoins, Info, LogOut, Pencil, PiggyBank, Plus, ShoppingBag, SlidersHorizontal, Target, Trash2, Undo2, Upload, X,
} from "lucide-react";

type Tone = "accent" | "warning" | "danger";

/** Ícone e tom padrão pela ação do título, para toda janela ter o mesmo cabeçalho mesmo sem ícone próprio. */
const ACTIONS: { words: string[]; icon: typeof Plus; tone: Tone }[] = [
  { words: ["excluir", "remover", "descartar", "apagar"], icon: Trash2, tone: "danger" },
  { words: ["cancelar", "cancelamento"], icon: Ban, tone: "danger" },
  { words: ["estornar"], icon: Undo2, tone: "warning" },
  { words: ["arquivar", "inativar"], icon: Archive, tone: "warning" },
  { words: ["reativar"], icon: ArchiveRestore, tone: "accent" },
  { words: ["editar", "alterar", "renomear"], icon: Pencil, tone: "accent" },
  { words: ["duplicar", "copiar"], icon: Copy, tone: "accent" },
  { words: ["ajustar"], icon: SlidersHorizontal, tone: "accent" },
  { words: ["registrar", "pagar", "receber", "confirmar"], icon: CircleCheck, tone: "accent" },
  { words: ["guardar"], icon: PiggyBank, tone: "accent" },
  { words: ["resgatar"], icon: HandCoins, tone: "accent" },
  { words: ["agendar", "previsão"], icon: CalendarClock, tone: "accent" },
  { words: ["planejar"], icon: CalendarRange, tone: "accent" },
  { words: ["importar", "continuar"], icon: Upload, tone: "accent" },
  { words: ["transferir"], icon: ArrowLeftRight, tone: "accent" },
  { words: ["lançar"], icon: ShoppingBag, tone: "accent" },
  { words: ["definir", "reserva"], icon: Target, tone: "accent" },
  { words: ["nova", "novo", "cadastrar", "criar", "adicionar"], icon: Plus, tone: "accent" },
  { words: ["perguntas", "ajuda", "suporte"], icon: CircleHelp, tone: "accent" },
  { words: ["termos", "política"], icon: FileText, tone: "accent" },
  { words: ["sair"], icon: LogOut, tone: "accent" },
];

function actionOf(title: string) {
  const first = title.trim().split(/\s+/)[0]?.toLocaleLowerCase("pt-BR") ?? "";
  return ACTIONS.find((action) => action.words.includes(first));
}

/** "Ajustar saldo — Conta corrente" vira título "Ajustar saldo" e contexto "Conta corrente". */
export function splitModalTitle(title: string): [string, string | null] {
  const index = title.indexOf(" — ");
  return index > 0 ? [title.slice(0, index), title.slice(index + 3)] : [title, null];
}

/**
 * Cabeçalho único das janelas (modais de ação, de cadastro, detalhes do painel e criação rápida):
 * quadro de ícone de tamanho fixo, título, linha de contexto e o botão de fechar. Sem ícone próprio,
 * usa o da ação do título; ações destrutivas ganham o tom de alerta.
 */
export function ModalHeader({ title, titleId, icon, onClose }: { title: string; titleId: string; icon?: ReactNode; onClose: () => void }) {
  const [main, context] = splitModalTitle(title);
  const action = actionOf(main);
  const Glyph = action?.icon ?? Info;
  const tone: Tone = action?.tone ?? "accent";
  return (
    <div className="modal-header">
      <div className="modal-heading">
        <span className={`modal-icon is-${tone}`} aria-hidden="true">{icon ?? <Glyph strokeWidth={1.8} />}</span>
        <div className="modal-titles">
          <h2 id={titleId}>{main}</h2>
          {context ? <p className="modal-context">{context}</p> : null}
        </div>
      </div>
      <button type="button" className="modal-close" aria-label="Fechar" onClick={onClose}>
        <X strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
