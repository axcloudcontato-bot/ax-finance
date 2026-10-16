"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AlertTriangle, BarChart3, Bell, CalendarClock, ChevronUp, CreditCard, FileCheck2, FileX2, Users, X } from "lucide-react";
import type { AppNotification } from "@/components/app-topbar";

/** Ícone por família de aviso (o tipo vem do banco; sem tipo, o sino). */
function iconFor(type?: string): ReactNode {
  const props = { className: "size-[18px]", strokeWidth: 1.8, "aria-hidden": true } as const;
  if (type === "TITLE_OVERDUE") return <AlertTriangle {...props} />;
  if (type?.startsWith("TITLE_")) return <CalendarClock {...props} />;
  if (type === "WEEKLY_SUMMARY") return <BarChart3 {...props} />;
  if (type === "IMPORT_FAILED") return <FileX2 {...props} />;
  if (type === "IMPORT_COMPLETED") return <FileCheck2 {...props} />;
  if (type === "INVITATION_ACCEPTED" || type === "ACCESS_ROLE_CHANGED") return <Users {...props} />;
  if (type?.startsWith("BILLING_")) return <CreditCard {...props} />;
  return <Bell {...props} />;
}

const RELATIVE = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto", style: "short" });

function timeAgo(value: string | Date): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return RELATIVE.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, "hour");
  return RELATIVE.format(-Math.round(hours / 24), "day");
}

/**
 * Avisos novos no canto inferior direito, no formato "cartão de atividades": recolhido mostra só
 * quantos são; aberto, a lista com ícone, resumo e há quanto tempo. Abrir um aviso marca como lido
 * (via `onOpen`); fechar o cartão não marca nada, os avisos seguem na campainha.
 */
export function NotificationActivities({
  items,
  onOpen,
  onDismiss,
  onHoldChange,
}: {
  items: AppNotification[];
  onOpen: (notification: AppNotification) => void;
  onDismiss: () => void;
  /** Enquanto aberto ou com o ponteiro/foco em cima, o cartão não some sozinho. */
  onHoldChange: (holding: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const first = items[0];
  if (!first) return null;
  const subtitle = items.length === 1 ? first.title : `${first.title} e mais ${items.length - 1}`;

  function toggle() {
    setOpen(!open);
    onHoldChange(!open);
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", bounce: 0, duration: 0.5 }}>
      <motion.div
        layout
        className="ax-activities"
        onMouseEnter={() => onHoldChange(true)}
        onMouseLeave={() => onHoldChange(open)}
        onFocus={() => onHoldChange(true)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHoldChange(open); }}
      >
        <div className="ax-activities-head">
          <button type="button" className="ax-activities-toggle" aria-expanded={open} aria-controls={listId} onClick={toggle}>
            <motion.span
              className="ax-activities-badge"
              initial={false}
              animate={{ width: open ? 34 : 42, height: open ? 34 : 42 }}
              aria-hidden="true"
            >
              <Bell className="size-5" strokeWidth={1.8} />
              <span className="ax-activities-count">{items.length}</span>
            </motion.span>
            <span className="ax-activities-titles">
              <motion.strong layout="position">{items.length === 1 ? "1 aviso novo" : `${items.length} avisos novos`}</motion.strong>
              <AnimatePresence mode="popLayout" initial={false}>
                {!open ? (
                  <motion.small key="subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {subtitle}
                  </motion.small>
                ) : null}
              </AnimatePresence>
            </span>
            <motion.span className="ax-activities-chevron" initial={false} animate={{ rotate: open ? 180 : 0 }} aria-hidden="true">
              <ChevronUp className="size-4" strokeWidth={2.2} />
            </motion.span>
          </button>
          <button type="button" className="ax-activities-close" aria-label="Fechar avisos" onClick={onDismiss}>
            <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.ul
              id={listId}
              key="list"
              className="ax-activities-list"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {items.map((notification, index) => (
                <motion.li key={notification.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * index }}>
                  <Link href={notification.href} className="ax-activities-item" onClick={() => onOpen(notification)}>
                    <span className={`ax-activities-icon${notification.type === "TITLE_OVERDUE" || notification.type === "IMPORT_FAILED" || notification.type === "BILLING_PAYMENT_FAILED" ? " is-alert" : ""}`}>
                      {iconFor(notification.type)}
                    </span>
                    <span className="ax-activities-text">
                      <strong>{notification.title}</strong>
                      <small>{notification.body}</small>
                    </span>
                    <time dateTime={new Date(notification.createdAt).toISOString()}>{timeAgo(notification.createdAt)}</time>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}
