"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/components/app-topbar";

const SHOWN_KEY = "ax-finance:toasts-shown:v1";
const MAX_VISIBLE = 2;
const AUTO_DISMISS_MS = 9000;

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
 */
export function NotificationToasts({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [visible, setVisible] = useState<AppNotification[]>([]);
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

  if (visible.length === 0) return null;

  return (
    <div className="ax-toasts" role="region" aria-label="Avisos recentes" aria-live="polite">
      {visible.map((notification) => (
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
