"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleNotch } from "@/components/ui/animated-icons";
import { OpenfixLogo } from "@/components/brand/openfix-logo";
import pageStyles from "./login.module.css";
import styles from "./auth.module.css";
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
    <button className={styles.submit} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <><CircleNotch className={pageStyles.spinner} size={18} aria-hidden="true" /> Entrando…</> : "Entrar"}
    </button>
  );
}

/**
 * Login no mesmo desenho do cadastro: formulário numa coluna calma e, no desktop, o painel da marca
 * com o extrato de exemplo que fecha o saldo.
 */
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
    <div className={`${pageStyles.page} ${styles.root}`}>
      <main className={styles.formSide}>
        <div className={styles.formInner}>
          <Link href="/" className={styles.brand} aria-label="Openfix, página inicial">
            <OpenfixLogo size={30} />
          </Link>

          <header className={styles.header}>
            <h1>Entrar</h1>
            <p>Acesse sua empresa ou as finanças da casa.</p>
          </header>

          {registrationCompleted ? (
            <p className={styles.notice} role="status">
              Enviamos um e-mail para você. Siga as instruções da mensagem para ativar sua conta e entrar. <Link href="/verificar-email">Reenviar confirmação</Link>
            </p>
          ) : null}
          {verificationRequired && !registrationCompleted ? (
            <p className={styles.error} role="status">
              Confirme seu e-mail antes de entrar. <Link href="/verificar-email">Reenviar confirmação</Link>
            </p>
          ) : null}
          {previewLink ? (
            <p className={styles.notice} role="status">Ambiente local: <Link href={previewLink}>abrir link de verificação</Link>.</p>
          ) : null}
          {emailVerified ? <p className={styles.notice} role="status">E-mail confirmado. Você já pode entrar.</p> : null}
          {passwordReset ? <p className={styles.notice} role="status">Senha redefinida. Entre novamente com a nova senha.</p> : null}
          {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}

          <form action={action} className={styles.form}>
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="password">Senha</label>
                <button type="button" className={styles.reveal} aria-controls="password" aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>
                  {passwordVisible ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input id="password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" required />
              <Link className={styles.textLink} href="/recuperar-senha">Esqueci minha senha</Link>
            </div>

            <label className={styles.checkbox}>
              <input type="checkbox" name="remember" />
              <span>Manter conectado neste computador</span>
            </label>

            <SubmitButton />
          </form>

          <p className={styles.switch}>Ainda não usa o Openfix? <Link href={registerHref}>Teste 14 dias grátis</Link></p>
          <p className={`${styles.legal} ${styles.legalLinks}`}><Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos de uso</Link></p>
        </div>
      </main>

      <aside className={styles.proofSide} aria-label="Como o Openfix mostra o seu saldo">
        <div className={styles.proofInner}>
          <p className={styles.proofEyebrow}>Conecte, organize e assuma o controle</p>
          <p className={styles.proofTitle}>Saiba quanto tem e o que vem pela frente.</p>
          <div className={styles.proofLedger}><Ledger /></div>
          <ul className={styles.facts}>
            <li>Dados separados por empresa</li>
            <li>Suporte em português</li>
            <li>Cancele quando quiser</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
