"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ConfirmMfaState } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return <SubmitButton disabled={pending}>{pending ? "Confirmando..." : "Ativar autenticação em duas etapas"}</SubmitButton>;
}

export function ConfirmMfaForm({
  action,
}: {
  action: (state: ConfirmMfaState, data: FormData) => Promise<ConfirmMfaState>;
}) {
  const [state, formAction] = useFormState(action, {});

  if (state.recoveryCodes) {
    return (
      <div className="success-box" role="status">
        <h2>Proteção ativada</h2>
        <p>Guarde estes códigos em um local seguro. Cada código funciona uma única vez e não será exibido novamente.</p>
        <div className="recovery-codes">
          {state.recoveryCodes.map((code) => <code key={code}>{code}</code>)}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <label htmlFor="mfa-code">Código de 6 dígitos</label>
      <input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" />
      <ConfirmButton />
    </form>
  );
}
