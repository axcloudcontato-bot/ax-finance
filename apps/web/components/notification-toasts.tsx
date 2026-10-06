"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/components/app-topbar";
import type { WriteBlockNotice } from "@/lib/write-block-notice";

const SHOWN_KEY = "ax-finance:toasts-shown:v1";
const BLOCK_DISMISSED_KEY = "ax-finance:block-notice-dismissed:v1";
const MAX_VISIBLE = 2;
const AUTO_DISMISS_MS = 9000;
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
 * inferior direito. Não substitui a campainha: fechar o aviso não marca como lida, abrir
 * o link marca. No máximo dois por vez, o mais recente primeiro.
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
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setVisible((current) => current.filter((item) => item.id !== id));
  }, []);

  const schedule = useCallback((id: string) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
  }, [dismiss]);

  const pause = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const shown = readShown();
    const fresh = notifications
      .filter((notification) => !notification.readAt && !shown.has(notification.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_VISIBLE);
    if (fresh.length === 0) return;

    // Tudo o que está não lido conta como visto: o restante fica só na campainha.
    for (const notification of notifications) if (!notification.readAt) shown.add(notification.id);
    writeShown(shown);

    setVisible((current) => [...fresh, ...current.filter((item) => !fresh.some((added) => added.id === item.id))].slice(0, MAX_VISIBLE));
    for (const notification of fresh) schedule(notification.id);
  }, [notifications, schedule]);

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  function open(notification: AppNotification) {
    dismiss(notification.id);
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
  const shown = visible.slice(0, MAX_VISIBLE - (blockVisible ? 1 : 0));
  if (!blockVisible && shown.length === 0 && flashes.length === 0) return null;

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
      {shown.map((notification) => (
        <div
          key={notification.id}
          className="ax-toast"
          onMouseEnter={() => pause(notification.id)}
          onMouseLeave={() => schedule(notification.id)}
          onFocus={() => pause(notification.id)}
          onBlur={() => schedule(notification.id)}
        >
          <Link href={notification.href} className="ax-toast-body" onClick={() => open(notification)}>
            <strong>{notification.title}</strong>
            <span>{notification.body}</span>
          </Link>
          <button type="button" className="ax-toast-close" aria-label="Fechar aviso" onClick={() => dismiss(notification.id)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
