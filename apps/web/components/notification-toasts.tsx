"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/components/app-topbar";
import type { WriteBlockNotice } from "@/lib/write-block-notice";
import { NotificationActivities } from "@/components/notification-activities";

const SHOWN_KEY = "ax-finance:toasts-shown:v1";
const BLOCK_DISMISSED_KEY = "ax-finance:block-notice-dismissed:v1";
const MAX_ITEMS = 5;
const AUTO_DISMISS_MS = 12000;
const FLASH_DISMISS_MS = 4000;
/** Confirmação curta disparada por outros componentes (ex.: "Entrada criada." no modal de criação rápida). */
const FLASH_EVENT = "ax:flash";

function readShown(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeShown(ids: Set<string>) {
  try {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...ids].slice(-100)));
  } catch {
    // Sem storage, o aviso pode reaparecer na próxima carga; nada além disso.
  }
}

/**
 * Lembretes e alertas não lidos aparecem uma vez por sessão num cartão pequeno no canto
 * inferior direito ("cartão de atividades": recolhido mostra quantos são; aberto, a lista).
 * Não substitui a campainha: fechar o cartão não marca como lido, abrir um aviso marca.
 * Some sozinho depois de alguns segundos, a menos que esteja aberto ou com o ponteiro em cima.
 *
 * Com a empresa bloqueada para escrita, o primeiro cartão é o aviso de bloqueio: no mesmo
 * lugar e tamanho, mas sem sumir sozinho; fica até ser fechado (e volta na próxima sessão).
 */
export function NotificationToasts({ notifications, blockNotice = null }: { notifications: AppNotification[]; blockNotice?: WriteBlockNotice | null }) {
  const router = useRouter();
  const [visible, setVisible] = useState<AppNotification[]>([]);
  const [showBlock, setShowBlock] = useState(false);
  const [flashes, setFlashes] = useState<{ id: number; message: string }[]>([]);

  useEffect(() => {
    let counter = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const onFlash = (event: Event) => {
      const id = ++counter;
      const message = String((event as CustomEvent<string>).detail ?? "");
      if (!message) return;
      setFlashes((current) => [...current, { id, message }].slice(-2));
      timeouts.push(setTimeout(() => setFlashes((current) => current.filter((item) => item.id !== id)), FLASH_DISMISS_MS));
    };
    window.addEventListener(FLASH_EVENT, onFlash);
    return () => {
      window.removeEventListener(FLASH_EVENT, onFlash);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Decidido no navegador (sessionStorage), depois da hidratação, para não piscar no servidor.
  useEffect(() => {
    if (!blockNotice) {
      setShowBlock(false);
      return;
    }
    try {
      setShowBlock(sessionStorage.getItem(BLOCK_DISMISSED_KEY) !== blockNotice.id);
    } catch {
      setShowBlock(true);
    }
  }, [blockNotice]);

  const dismissBlock = useCallback(() => {
    setShowBlock(false);
    try {
      if (blockNotice) sessionStorage.setItem(BLOCK_DISMISSED_KEY, blockNotice.id);
    } catch {
      // Sem storage, o aviso volta na próxima carga; nada além disso.
    }
  }, [blockNotice]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setVisible([]);
  }, []);

  // Segurando (aberto, ponteiro ou foco em cima) o cartão fica; ao soltar, volta a contar.
  const hold = useCallback((holding: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = holding ? null : setTimeout(dismiss, AUTO_DISMISS_MS);
  }, [dismiss]);

  useEffect(() => {
    const shown = readShown();
    const unread = notifications
      .filter((notification) => !notification.readAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!unread.some((notification) => !shown.has(notification.id))) return;

    // Tudo o que está não lido conta como visto nesta sessão: depois, só na campainha.
    for (const notification of unread) shown.add(notification.id);
    writeShown(shown);

    setVisible(unread.slice(0, MAX_ITEMS));
    hold(false);
  }, [notifications, hold]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function open(notification: AppNotification) {
    dismiss();
    // Depois de gravar, pede a casca de volta para a bolinha da campainha acompanhar.
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: notification.id }),
    })
      .then(() => router.refresh())
      .catch(() => undefined);
  }

  const blockVisible = showBlock && blockNotice;
  if (!blockVisible && visible.length === 0 && flashes.length === 0) return null;

  return (
    <div className="ax-toasts" role="region" aria-label="Avisos recentes" aria-live="polite">
      {flashes.map((item) => (
        <div key={item.id} className="ax-toast is-flash" role="status">
          <div className="ax-toast-body"><strong>{item.message}</strong></div>
        </div>
      ))}
      {blockVisible ? (
        <div className="ax-toast is-alert">
          {blockNotice.href ? (
            <Link href={blockNotice.href} className="ax-toast-body">
              <strong>{blockNotice.title}</strong>
              <span>{blockNotice.body}</span>
            </Link>
          ) : (
            <div className="ax-toast-body">
              <strong>{blockNotice.title}</strong>
              <span>{blockNotice.body}</span>
            </div>
          )}
          <button type="button" className="ax-toast-close" aria-label="Fechar aviso" onClick={dismissBlock}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ) : null}
      {visible.length > 0 ? <NotificationActivities items={visible} onOpen={open} onDismiss={dismiss} onHoldChange={hold} /> : null}
    </div>
  );
}
