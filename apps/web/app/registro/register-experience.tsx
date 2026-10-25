"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleNotch } from "@/components/ui/animated-icons";
import { OpenfixLogo } from "@/components/brand/openfix-logo";
import { Ledger } from "../login/ledger";
import loginStyles from "../login/login.module.css";
import styles from "../login/auth.module.css";
import type { RegisterField, RegisterState } from "./actions";

type PlanCode = "PERSONAL" | "ESSENTIAL";

const PLANS: { code: PlanCode; name: string; price: string; detail: string }[] = [
  { code: "PERSONAL", name: "Gestão Pessoal", price: "R$ 29,90/mês", detail: "Para as finanças da casa: entradas, saídas, contas, categorias, dashboard e fluxo de caixa." },
  { code: "ESSENTIAL", name: "Essencial", price: "R$ 59/mês", detail: "Para a pequena empresa: tudo do Pessoal, mais importação de extrato, conciliação, fechamento, auditoria e DRE." },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.submit} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <><CircleNotch className={loginStyles.spinner} size={18} aria-hidden="true" /> Criando conta…</> : "Criar conta"}
    </button>
  );
}

/**
 * Cadastro em duas metades: o formulário sozinho numa coluna calma (sem ícones nos campos, plano
 * num seletor de duas opções) e, no desktop, um painel marinho com o extrato de exemplo — a mesma
 * prova do produto que aparece no login.
 */
export function RegisterExperience({
  action,
  errorMessage,
  returnTo,
  initialPlan,
}: {
  action: (previous: RegisterState, formData: FormData) => Promise<RegisterState>;
  errorMessage?: string;
  returnTo?: string;
  initialPlan: PlanCode;
}) {
  const [plan, setPlan] = useState<PlanCode>(initialPlan);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [state, formAction] = useActionState(action, { error: errorMessage });
  const formRef = useRef<HTMLFormElement>(null);
  // Depois de um erro, o foco vai para o campo a corrigir (o nome e o e-mail voltam preenchidos).
  useEffect(() => {
    if (state.field) formRef.current?.querySelector<HTMLInputElement>(`#${state.field}`)?.focus();
  }, [state]);
  const invalid = (field: RegisterField) => (state.field === field ? { "aria-invalid": true, "aria-errormessage": "register-error" } : {});
  const loginHref = returnTo ? `/login?retorno=${encodeURIComponent(returnTo)}` : "/login";
  const chosen = PLANS.find((item) => item.code === plan)!;

  return (
    <div className={`${loginStyles.page} ${styles.root}`}>
      <main className={styles.formSide}>
        <div className={styles.formInner}>
          <Link href="/" className={styles.brand} aria-label="Openfix, página inicial">
            <OpenfixLogo size={30} />
          </Link>

          <header className={styles.header}>
            <h1>Criar sua conta</h1>
            <p>14 dias grátis. Sem cartão de crédito.</p>
          </header>

          {state.error ? <p id="register-error" className={styles.error} role="alert">{state.error}</p> : null}

          <form ref={formRef} action={formAction} className={styles.form}>
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

            <fieldset className={styles.plan}>
              <legend>Plano</legend>
              <div className={styles.segmented}>
                {PLANS.map((item) => (
                  <label key={item.code} data-checked={plan === item.code || undefined}>
                    <input type="radio" name="planCode" value={item.code} checked={plan === item.code} onChange={() => setPlan(item.code)} />
                    <span className={styles.planName}>{item.name}</span>
                    <span className={styles.planPrice}>{item.price}</span>
                  </label>
                ))}
              </div>
              <p className={styles.planDetail} aria-live="polite">{chosen.detail}</p>
            </fieldset>

            <div className={styles.field}>
              <label htmlFor="name">Nome</label>
              <input id="name" name="name" type="text" autoComplete="name" required maxLength={200} defaultValue={state.name} {...invalid("name")} />
            </div>

            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} defaultValue={state.email} {...invalid("email")} />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="password">Senha</label>
                <button type="button" className={styles.reveal} aria-controls="password" aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>
                  {passwordVisible ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input id="password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="new-password" required minLength={8} aria-describedby="password-hint" {...invalid("password")} />
              <small id="password-hint" className={styles.hint}>Use pelo menos 8 caracteres.</small>
            </div>

            <SubmitButton />

            <p className={styles.legal}>
              Ao continuar, você concorda com os <Link href="/termos">Termos de uso</Link> e a <Link href="/privacidade">Política de privacidade</Link>.
            </p>
          </form>

          <p className={styles.switch}>Já tem conta? <Link href={loginHref}>Entrar</Link></p>
        </div>
      </main>

      <aside className={styles.proofSide} aria-label="Como o Openfix mostra o seu saldo">
        <div className={styles.proofInner}>
          <p className={styles.proofEyebrow}>Conecte, organize e assuma o controle</p>
          <p className={styles.proofTitle}>O saldo de hoje e o das próximas semanas, explicados linha a linha.</p>
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
