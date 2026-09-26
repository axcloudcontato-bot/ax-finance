"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockSimple,
  Wallet,
  X,
} from "@phosphor-icons/react";
import styles from "./login.module.css";

type LoginExperienceProps = {
  action: (formData: FormData) => Promise<void>;
  errorMessage?: string;
  registrationCompleted: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending ? (
        <>
          <CircleNotch className={styles.spinner} size={23} aria-hidden="true" />
          Entrando...
        </>
      ) : (
        <>
          Entrar na minha conta
          <ArrowRight size={25} aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export function LoginExperience({
  action,
  errorMessage,
  registrationCompleted,
}: LoginExperienceProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const recoveryDialog = useRef<HTMLDialogElement>(null);
  const legalDialog = useRef<HTMLDialogElement>(null);
  const [legalTitle, setLegalTitle] = useState("");

  function openRecovery() {
    setRecoverySent(false);
    recoveryDialog.current?.showModal();
  }

  function openLegal(title: string) {
    setLegalTitle(title);
    legalDialog.current?.showModal();
  }

  return (
    <div className={styles.page}>
      <main className={styles.authCard} aria-label="Acesso ao AX Finance">
        <aside className={styles.welcome}>
          <div className={styles.brand}>
            <Wallet size={44} weight="regular" aria-hidden="true" />
            <span>AX Finance</span>
          </div>

          <div className={styles.welcomeCopy}>
            <h1>
              Seu dinheiro
              <br />
              organizado.
              <br />
              Sua vida mais leve.
            </h1>
            <p>Mais clareza para cuidar das suas finanças.</p>
          </div>

          <div className={styles.welcomeAction}>
            <p>Ainda não tem uma conta?</p>
            <Link className={styles.outlineButton} href="/registro">
              Criar minha conta
            </Link>
          </div>
        </aside>

        <section className={styles.formPanel} aria-labelledby="login-title">
          <div className={styles.formContent}>
            <header className={styles.formHeader}>
              <h2 id="login-title">Bem-vindo de volta</h2>
              <p>Entre para acompanhar suas finanças.</p>
            </header>

            {registrationCompleted && (
              <p className={`${styles.status} ${styles.success}`} role="status">
                Cadastro concluído. Faça login para continuar.
              </p>
            )}

            {errorMessage && (
              <p className={`${styles.status} ${styles.error}`} role="alert">
                {errorMessage}
              </p>
            )}

            <form action={action} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email">E-mail</label>
                <div className={styles.inputWrap}>
                  <EnvelopeSimple size={23} aria-hidden="true" />
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
                <label htmlFor="password">Senha</label>
                <div className={styles.inputWrap}>
                  <LockSimple size={23} aria-hidden="true" />
                  <input
                    id="password"
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    required
                  />
                  <button
                    className={styles.eyeButton}
                    type="button"
                    aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? <EyeSlash size={24} /> : <Eye size={24} />}
                  </button>
                </div>
              </div>

              <div className={styles.options}>
                <label className={styles.checkbox}>
                  <input type="checkbox" name="remember" />
                  <span>Lembrar de mim</span>
                </label>
                <button className={styles.textButton} type="button" onClick={openRecovery}>
                  Esqueci minha senha
                </button>
              </div>

              <SubmitButton />
            </form>

            <div className={styles.tagline}>
              <span>Seu próximo passo começa com organização.</span>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>AX Finance · Gestão financeira pessoal</p>
        <nav aria-label="Informações legais">
          <button type="button" onClick={() => openLegal("Privacidade")}>
            Privacidade
          </button>
          <span aria-hidden="true">|</span>
          <button type="button" onClick={() => openLegal("Termos de uso")}>
            Termos de uso
          </button>
        </nav>
      </footer>

      <dialog className={styles.dialog} ref={recoveryDialog} aria-labelledby="recovery-title">
        <button
          className={styles.dialogClose}
          type="button"
          aria-label="Fechar"
          onClick={() => recoveryDialog.current?.close()}
        >
          <X size={21} aria-hidden="true" />
        </button>
        <h2 id="recovery-title">Recuperar acesso</h2>
        {recoverySent ? (
          <p role="status">
            A recuperação por e-mail ainda está em preparação. Entre em contato com o suporte
            para recuperar seu acesso.
          </p>
        ) : (
          <>
            <p>Informe seu e-mail para iniciar a recuperação da conta.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setRecoverySent(true);
              }}
            >
              <label htmlFor="recovery-email">E-mail</label>
              <div className={styles.inputWrap}>
                <EnvelopeSimple size={23} aria-hidden="true" />
                <input
                  id="recovery-email"
                  name="recovery-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  required
                />
              </div>
              <button className={styles.dialogAction} type="submit">
                Continuar
              </button>
            </form>
          </>
        )}
      </dialog>

      <dialog className={styles.dialog} ref={legalDialog} aria-labelledby="legal-title">
        <button
          className={styles.dialogClose}
          type="button"
          aria-label="Fechar"
          onClick={() => legalDialog.current?.close()}
        >
          <X size={21} aria-hidden="true" />
        </button>
        <h2 id="legal-title">{legalTitle}</h2>
        <p>
          O documento oficial será disponibilizado pelo AX Finance antes do lançamento comercial.
        </p>
        <button
          className={styles.dialogAction}
          type="button"
          onClick={() => legalDialog.current?.close()}
        >
          Fechar
        </button>
      </dialog>
    </div>
  );
}
