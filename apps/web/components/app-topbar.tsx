"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Wallet } from "@/components/ui/animated-icons";
import { initialsOf } from "@/lib/user-display";
import { ExpandableSearchBar } from "@/components/ui/expandable-search-bar";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | Date | null;
  createdAt: string | Date;
}

interface SearchResults {
  titles: { id: string; type: "RECEIVABLE" | "PAYABLE"; description: string }[];
  parties: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

const EMPTY_RESULTS: SearchResults = { titles: [], parties: [], categories: [] };

export function AppTopbar({ userName, notifications: initialNotifications }: { userName: string; notifications: AppNotification[] }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        setResults(response.ok ? await response.json() : EMPTY_RESULTS);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, searchOpen]);

  const hasResults = results.titles.length > 0 || results.parties.length > 0 || results.categories.length > 0;
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  async function markRead(id: string) {
    setNotifications((current) => current.map((notification) => (
      notification.id === id ? { ...notification, readAt: new Date() } : notification
    )));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function markAllRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? new Date() })));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <header
      className="flex h-16 w-full shrink-0 items-center justify-between px-5 text-white"
      style={{ background: "var(--grad-blue)" }}
    >
      <div className="flex items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-white/20">
          <Wallet className="size-4" />
        </div>
        <span className="hidden text-base font-semibold sm:inline">AX Finance</span>
      </div>

      <div className="flex h-10 items-center gap-1.5 sm:gap-2">
        <div ref={searchRef} className="relative flex size-10 items-center justify-center">
          <ExpandableSearchBar
            open={searchOpen}
            value={query}
            onOpenChange={setSearchOpen}
            onValueChange={setQuery}
            onSearch={() => undefined}
            placeholder="Pesquisar títulos, pessoas ou categorias"
            width={320}
          />

          {searchOpen && (loading || query.trim().length >= 2) ? (
            <div className="topbar-dropdown">
              {loading ? <p className="muted" style={{ margin: "0.75rem 0.25rem" }}>Buscando...</p> : null}

              {!loading && query.trim().length >= 2 && !hasResults ? (
                <p className="muted" style={{ margin: "0.75rem 0.25rem" }}>Nada encontrado.</p>
              ) : null}

              {results.titles.length > 0 ? (
                <>
                  <h2>Títulos</h2>
                  {results.titles.map((title) => (
                    <Link
                      key={title.id}
                      href={title.type === "PAYABLE" ? `/saidas/${title.id}` : `/entradas/${title.id}`}
                      className="topbar-dropdown-item"
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="title">{title.description}</span>
                      <span className="subtitle">{title.type === "PAYABLE" ? "Saída" : "Entrada"}</span>
                    </Link>
                  ))}
                </>
              ) : null}

              {results.parties.length > 0 ? (
                <>
                  <h2>Clientes e fornecedores</h2>
                  {results.parties.map((party) => (
                    <Link
                      key={party.id}
                      href={`/cadastros/pessoas/${party.id}`}
                      className="topbar-dropdown-item"
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="title">{party.name}</span>
                    </Link>
                  ))}
                </>
              ) : null}

              {results.categories.length > 0 ? (
                <>
                  <h2>Categorias</h2>
                  {results.categories.map((category) => (
                    <Link
                      key={category.id}
                      href="/cadastros/categorias"
                      className="topbar-dropdown-item"
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="title">{category.name}</span>
                    </Link>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div ref={notifRef} className="relative flex size-10 items-center justify-center">
          <button
            type="button"
            className="topbar-icon-button"
            aria-label="Notificações"
            onClick={() => setNotifOpen((open) => !open)}
          >
            <Bell className="size-5 opacity-90" />
            {unreadCount > 0 ? <span className="topbar-badge" /> : null}
          </button>

          {notifOpen ? (
            <div className="topbar-dropdown">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                <h2 style={{ marginTop: "0.25rem" }}>Notificações</h2>
                {unreadCount > 0 ? (
                  <button type="button" className="topbar-mark-read" onClick={() => void markAllRead()}>
                    Marcar como lidas
                  </button>
                ) : null}
              </div>
              {notifications.length === 0 ? (
                <p className="muted" style={{ margin: "0.75rem 0.25rem" }}>Nada por aqui — em dia.</p>
              ) : (
                notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.href}
                    className="topbar-dropdown-item"
                    onClick={() => {
                      setNotifOpen(false);
                      if (!notification.readAt) void markRead(notification.id);
                    }}
                    style={{ opacity: notification.readAt ? 0.7 : 1 }}
                  >
                    <span className="title">{notification.title}</span>
                    <span className="subtitle">{notification.body}</span>
                  </Link>
                ))
              )}
            </div>
          ) : null}
        </div>

        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-semibold">
          {initialsOf(userName)}
        </span>
      </div>
    </header>
  );
}
