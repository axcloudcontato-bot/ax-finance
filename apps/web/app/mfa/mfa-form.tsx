"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight, CircleNotch, Key, ShieldCheck, Wallet } from "@/components/ui/animated-icons";
import type { MfaLoginState } from "./actions";
import styles from "../login/login.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.primaryButton} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <><CircleNotch className={styles.spinner} size={20} aria-hidden="true" /> Validando…</> : <>Confirmar acesso <ArrowRight size={20} aria-hidden="true" /></>}
    </button>
  );
}

export function MfaForm({
  action,
  returnTo,
}: {
  action: (state: MfaLoginState, data: FormData) => Promise<MfaLoginState>;
  returnTo?: string;
}) {
  const [state, formAction] = useFormState(action, {});
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="AX Finance, página inicial">
          <span className={styles.brandMark} aria-hidden="true"><Wallet size={18} /></span>
          AX Finance
        </Link>
      </header>
      <main className={styles.layoutSingle}>
        <section className={styles.formCard} aria-labelledby="mfa-title">
          <span className={styles.formIcon} aria-hidden="true"><ShieldCheck size={22} /></span>
          <header className={styles.formHeader}>
            <h1 id="mfa-title">Confirme que é você</h1>
            <p>Digite o código de 6 dígitos do aplicativo autenticador ou um código de recuperação.</p>
          </header>
          {state.error ? <p className={`${styles.status} ${styles.error}`} role="alert">{state.error}</p> : null}
          <form action={formAction} className={styles.form}>
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <div className={styles.field}>
              <label htmlFor="code">Código de verificação</label>
              <div className={styles.inputWrap}>
                <Key size={18} aria-hidden="true" />
                <input id="code" name="code" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} autoFocus required placeholder="000000" />
              </div>
            </div>
            <label className={styles.checkbox}>
              <input type="checkbox" name="trustDevice" />
              <span>Confiar neste dispositivo por 30 dias</span>
            </label>
            <SubmitButton />
          </form>
          <p className={styles.hint}>O código muda a cada 30 segundos.</p>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>AX Finance · gestão financeira para empresa e casa</p>
        <nav aria-label="Informações legais">
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
        </nav>
      </footer>
    </div>
  );
}
