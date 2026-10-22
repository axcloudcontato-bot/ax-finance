"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockSimple,
  Wallet,
} from "@/components/ui/animated-icons";
import styles from "./login.module.css";
import { Ledger } from "./ledger";

type LoginExperienceProps = {
  action: (formData: FormData) => Promise<void>;
  errorMessage?: string;
  registrationCompleted: boolean;
  returnTo?: string;
  verificationRequired: boolean;
  previewLink?: string;
  emailVerified: boolean;
  passwordReset: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <CircleNotch className={styles.spinner} size={20} aria-hidden="true" />
          Entrando…
        </>
      ) : (
        <>
          Entrar
          <ArrowRight size={20} aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export function LoginExperience({
  action,
  errorMessage,
  registrationCompleted,
  returnTo,
  verificationRequired,
  previewLink,
  emailVerified,
  passwordReset,
}: LoginExperienceProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const registerHref = returnTo ? `/registro?retorno=${encodeURIComponent(returnTo)}` : "/registro";

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="AX Finance, página inicial">
          <span className={styles.brandMark} aria-hidden="true"><Wallet size={18} /></span>
          AX Finance
        </Link>
      </header>

      <main className={styles.layout}>
        <section className={styles.story} aria-labelledby="login-story">
          <h1 id="login-story">Saiba quanto tem e o que vem pela frente.</h1>
          <p className={styles.lede}>Entradas, saídas e contas no mesmo extrato. O saldo de hoje e a previsão das próximas semanas se explicam linha a linha.</p>
          <Ledger />
        </section>

        <section className={styles.formCard} aria-labelledby="login-title">
          <header className={styles.formHeader}>
            <h2 id="login-title">Entrar</h2>
            <p>Acesse sua empresa ou as finanças da casa.</p>
          </header>

          {registrationCompleted && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              Enviamos um e-mail para você. Siga as instruções da mensagem para ativar sua conta e entrar. <Link href="/verificar-email">Reenviar confirmação</Link>
            </p>
          )}

          {verificationRequired && !registrationCompleted && (
            <p className={`${styles.status} ${styles.error}`} role="status">
              Confirme seu e-mail antes de entrar. <Link href="/verificar-email">Reenviar confirmação</Link>
            </p>
          )}

          {previewLink && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              Ambiente local: <Link href={previewLink}>abrir link de verificação</Link>.
            </p>
          )}

          {emailVerified && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              E-mail confirmado. Você já pode entrar.
            </p>
          )}

          {passwordReset && (
            <p className={`${styles.status} ${styles.success}`} role="status">
              Senha redefinida. Entre novamente com a nova senha.
            </p>
          )}

          {errorMessage && (
            <p className={`${styles.status} ${styles.error}`} role="alert">
              {errorMessage}
            </p>
          )}

          <form action={action} className={styles.form}>
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <div className={styles.inputWrap}>
                <EnvelopeSimple size={18} aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="voce@exemplo.com"
                  required
                  maxLength={254}
                />
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="password">Senha</label>
                <Link className={styles.textLink} href="/recuperar-senha">Esqueci minha senha</Link>
              </div>
              <div className={styles.inputWrap}>
                <LockSimple size={18} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  className={styles.eyeButton}
                  type="button"
                  aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className={styles.checkbox}>
              <input type="checkbox" name="remember" />
              <span>Manter conectado neste computador</span>
            </label>

            <SubmitButton />
          </form>

          <p className={styles.register}>
            Ainda não usa o AX Finance? <Link href={registerHref}>Teste 14 dias grátis</Link>
          </p>
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
