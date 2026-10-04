"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ComputerIcon,
  DashboardSquare01Icon,
  Exchange01Icon,
  Logout03Icon,
  Moon02Icon,
  Notification03Icon,
  PlusSignIcon,
  Search01Icon,
  SecurityCheckIcon,
  Settings01Icon,
  Sun03Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import useMeasure from "react-use-measure";
import type { AppNotification } from "@/components/app-topbar";
import { cn } from "@/lib/utils";

type MenuView = "default" | "actions" | "search" | "notifications" | "profile" | "theme";
type ThemePreference = "light" | "dark" | "system";

interface SearchResults {
  titles: { id: string; type: "RECEIVABLE" | "PAYABLE"; description: string }[];
  parties: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

interface BottomMenuProps {
  /** "top" encaixa a barra no topo (popover abre para baixo, à direita). */
  placement?: "bottom" | "top";
  userName: string;
  canManageMembers: boolean;
  notifications: AppNotification[];
  logoutAction: () => void | Promise<void>;
}

const EMPTY_RESULTS: SearchResults = { titles: [], parties: [], categories: [] };
const THEME_KEY = "ax-finance:theme:v1";

const MENU_ITEMS = [
  { icon: PlusSignIcon, name: "actions", label: "Criar" },
  { icon: Search01Icon, name: "search", label: "Pesquisar" },
  { icon: Notification03Icon, name: "notifications", label: "Notificações" },
  { icon: UserEdit01Icon, name: "profile", label: "Perfil" },
  { icon: Sun03Icon, name: "theme", label: "Aparência" },
] as const;

const THEME_OPTIONS = [
  { key: "light", icon: Sun03Icon, text: "Claro" },
  { key: "dark", icon: Moon02Icon, text: "Escuro" },
  { key: "system", icon: ComputerIcon, text: "Sistema" },
] as const;

function applyTheme(preference: ThemePreference) {
  const resolved = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  document.documentElement.dataset.axTheme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

function MenuRow({ href, icon, children, onClick }: { href: string; icon: typeof PlusSignIcon; children: ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="bottom-menu-row group">
      <HugeiconsIcon icon={icon} size={19} strokeWidth={1.8} />
      <span>{children}</span>
    </Link>
  );
}

export function BottomMenu({ placement = "bottom", userName, canManageMembers, notifications: initialNotifications, logoutAction }: BottomMenuProps) {
  const top = placement === "top";
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [contentRef] = useMeasure();
  const [measureRef, bounds] = useMeasure();
  const [view, setView] = useState<MenuView>("default");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [searching, setSearching] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [theme, setTheme] = useState<ThemePreference>("system");

  const closeMenu = useCallback(() => setView("default"), []);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const hasResults = results.titles.length > 0 || results.parties.length > 0 || results.categories.length > 0;

  useEffect(() => closeMenu(), [pathname, closeMenu]);

  useEffect(() => setNotifications(initialNotifications), [initialNotifications]);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemePreference | null;
    const preference = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setTheme(preference);
    applyTheme(preference);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if ((localStorage.getItem(THEME_KEY) ?? "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) closeMenu();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeMenu]);

  useEffect(() => {
    function openSearch(event: KeyboardEvent) {
      if (event.isComposing || event.key.toLowerCase() !== "k" || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      setView("search");
    }
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  useEffect(() => {
    if (view === "search") searchInputRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (view !== "search" || query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        setResults(response.ok ? await response.json() as SearchResults : EMPTY_RESULTS);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults(EMPTY_RESULTS);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [query, view]);

  async function markRead(id: string) {
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date() } : item));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date() })));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  function selectTheme(preference: ThemePreference) {
    setTheme(preference);
    localStorage.setItem(THEME_KEY, preference);
    applyTheme(preference);
  }

  const content = (() => {
    if (view === "actions") {
      return (
        <div className="bottom-menu-list min-w-[230px]">
          <MenuRow href="/entradas?novo=1" icon={ArrowDown01Icon} onClick={closeMenu}>Nova receita</MenuRow>
          <MenuRow href="/saidas?novo=1" icon={ArrowUp01Icon} onClick={closeMenu}>Nova despesa</MenuRow>
          <MenuRow href="/transferencias/novo" icon={Exchange01Icon} onClick={closeMenu}>Nova transferência</MenuRow>
        </div>
      );
    }

    if (view === "search") {
      return (
        <div className="w-[min(340px,calc(100vw-24px))] p-2">
          <div className="bottom-menu-search">
            <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.8} />
            <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar títulos, pessoas ou categorias" aria-label="Pesquisar" />
          </div>
          {query.trim().length < 2 ? (
            <div className="grid grid-cols-2 gap-1.5 pt-2">
              <MenuRow href="/entradas" icon={ArrowDown01Icon} onClick={closeMenu}>Entradas</MenuRow>
              <MenuRow href="/saidas" icon={ArrowUp01Icon} onClick={closeMenu}>Saídas</MenuRow>
            </div>
          ) : searching ? (
            <p className="bottom-menu-empty">Buscando...</p>
          ) : !hasResults ? (
            <p className="bottom-menu-empty">Nenhum resultado encontrado.</p>
          ) : (
            <div className="bottom-menu-results">
              {results.titles.map((title) => (
                <Link key={title.id} href={title.type === "PAYABLE" ? `/saidas/${title.id}` : `/entradas/${title.id}`} onClick={closeMenu}>
                  <strong>{title.description}</strong><small>{title.type === "PAYABLE" ? "Saída" : "Entrada"}</small>
                </Link>
              ))}
              {results.parties.map((party) => <Link key={party.id} href={`/cadastros/pessoas/${party.id}`} onClick={closeMenu}><strong>{party.name}</strong><small>Cliente/fornecedor</small></Link>)}
              {results.categories.map((category) => <Link key={category.id} href="/cadastros/categorias" onClick={closeMenu}><strong>{category.name}</strong><small>Categoria</small></Link>)}
            </div>
          )}
        </div>
      );
    }

    if (view === "notifications") {
      return (
        <div className="w-[min(340px,calc(100vw-24px))] p-2">
          <div className="bottom-menu-heading"><strong>Notificações</strong>{unreadCount > 0 ? <button type="button" onClick={() => void markAllRead()}>Marcar como lidas</button> : null}</div>
          {notifications.length === 0 ? <p className="bottom-menu-empty">Tudo em dia por aqui.</p> : (
            <div className="bottom-menu-results">
              {notifications.slice(0, 6).map((notification) => (
                <Link key={notification.id} href={notification.href} className={notification.readAt ? "is-read" : undefined} onClick={() => { closeMenu(); if (!notification.readAt) void markRead(notification.id); }}>
                  <strong>{notification.title}</strong><small>{notification.body}</small>
                </Link>
              ))}
            </div>
          )}
          <Link className="bottom-menu-footer-link" href="/configuracoes/notificacoes" onClick={closeMenu}>Configurar notificações</Link>
        </div>
      );
    }

    if (view === "profile") {
      return (
        <div className="bottom-menu-list min-w-[245px]">
          <div className="bottom-menu-user"><span>{userName.slice(0, 1).toUpperCase()}</span><div><strong>{userName}</strong><small>Minha conta</small></div></div>
          <MenuRow href="/dashboard" icon={DashboardSquare01Icon} onClick={closeMenu}>Dashboard</MenuRow>
          <MenuRow href="/configuracoes/seguranca" icon={SecurityCheckIcon} onClick={closeMenu}>Segurança</MenuRow>
          {canManageMembers ? <MenuRow href="/configuracoes/assinatura" icon={Settings01Icon} onClick={closeMenu}>Assinatura</MenuRow> : null}
          <form action={logoutAction} className="border-t border-border pt-1">
            <button type="submit" className="bottom-menu-row bottom-menu-logout" onClick={() => {
              sessionStorage.removeItem("ax-finance:period-filter:v1");
              Object.keys(sessionStorage).filter((key) => key.startsWith("ax-finance:dashboard-filters:v1:")).forEach((key) => sessionStorage.removeItem(key));
            }}><HugeiconsIcon icon={Logout03Icon} size={19} strokeWidth={1.8} /><span>Sair</span></button>
          </form>
        </div>
      );
    }

    if (view === "theme") {
      return (
        <div className="flex min-w-[286px] items-center gap-1.5 p-1.5">
          {THEME_OPTIONS.map((option) => (
            <button key={option.key} type="button" aria-pressed={theme === option.key} onClick={() => selectTheme(option.key)} className={cn("bottom-menu-theme", theme === option.key && "is-active")}>
              <HugeiconsIcon icon={option.icon} size={18} strokeWidth={1.8} /><span>{option.text}</span>
            </button>
          ))}
        </div>
      );
    }

    return null;
  })();

  return (
    <div ref={containerRef} className={cn("bottom-menu-shell", top && "is-top")} aria-label="Ações rápidas">
      <div ref={measureRef} className="pointer-events-none invisible fixed -left-[9999px] -top-[9999px]">
        <div className="bottom-menu-popover">{content}</div>
      </div>

      <AnimatePresence mode="wait">
        {view !== "default" ? (
          <motion.div
            key="bottom-menu-popover"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.94, height: 0, width: 0, y: top ? -8 : 8 }}
            animate={{ opacity: 1, scale: 1, height: bounds.height || "auto", width: bounds.width || "auto", y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, height: 0, width: 0, y: top ? -8 : 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.45, 0, 0.25, 1] }}
            className="bottom-menu-popover-wrap"
            style={{ transformOrigin: top ? "top right" : "bottom center" }}
          >
            <div ref={contentRef} className="bottom-menu-popover">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div key={view} initial={reduceMotion ? false : { opacity: 0, scale: 0.97, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: "blur(8px)" }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
                  {content}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="bottom-menu-toolbar">
        {MENU_ITEMS.map((item) => {
          const active = view === item.name;
          return (
            <button key={item.name} type="button" aria-label={item.label} aria-keyshortcuts={item.name === "search" ? "Control+K Meta+K" : undefined} title={item.name === "search" ? "Pesquisar (Ctrl/⌘ K)" : item.label} aria-expanded={active} onClick={() => setView(active ? "default" : item.name)} className={cn("bottom-menu-trigger", active && "is-active")}>
              <HugeiconsIcon icon={item.icon} size={22} strokeWidth={1.8} />
              {item.name === "notifications" && unreadCount > 0 ? <span className="bottom-menu-badge">{Math.min(unreadCount, 9)}{unreadCount > 9 ? "+" : ""}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

