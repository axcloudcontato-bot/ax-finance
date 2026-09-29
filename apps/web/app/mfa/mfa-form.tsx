"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight, CircleNotch, Key, ShieldCheck, Wallet } from "@/components/ui/animated-icons";
import type { MfaLoginState } from "./actions";
import styles from "../login/login.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending ? <><CircleNotch className={styles.spinner} size={23} /> Validando...</> : <>Confirmar acesso <ArrowRight size={25} /></>}
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
      <main className={styles.authCard} aria-label="Confirmação em duas etapas">
        <aside className={styles.welcome}>
          <div className={styles.brand}><Wallet size={44} /><span>AX Finance</span></div>
          <div className={styles.welcomeCopy}>
            <h1>Sua conta,<br />ainda mais<br />protegida.</h1>
            <p>Uma confirmação extra para manter seus dados seguros.</p>
          </div>
          <div className={styles.welcomeAction}><ShieldCheck size={58} weight="duotone" /></div>
        </aside>
        <section className={styles.formPanel} aria-labelledby="mfa-title">
          <div className={styles.formContent}>
            <header className={styles.formHeader}>
              <h2 id="mfa-title">Verificação de segurança</h2>
              <p>Digite o código do autenticador ou um código de recuperação.</p>
            </header>
            {state.error ? <p className={`${styles.status} ${styles.error}`} role="alert">{state.error}</p> : null}
            <form action={formAction} className={styles.form}>
              {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
              <div className={styles.field}>
                <label htmlFor="code">Código de verificação</label>
                <div className={styles.inputWrap}>
                  <Key size={23} aria-hidden="true" />
                  <input id="code" name="code" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} autoFocus required placeholder="000000 ou código de recuperação" />
                </div>
              </div>
              <SubmitButton />
            </form>
            <div className={styles.tagline}><span>O código expira em poucos minutos.</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
