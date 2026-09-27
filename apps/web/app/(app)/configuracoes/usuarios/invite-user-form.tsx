"use client";

import { useFormState, useFormStatus } from "react-dom";
import { inviteUserAction, type InviteUserState } from "./actions";

const initialState: InviteUserState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Enviando..." : "Enviar convite"}</button>;
}

export function InviteUserForm() {
  const [state, action] = useFormState(inviteUserAction, initialState);
  const inviteUrl = state.invitePath && typeof window !== "undefined"
    ? `${window.location.origin}${state.invitePath}`
    : state.invitePath;

  return (
    <div className="card">
      <h1>Convidar usuário</h1>
      <p className="subtitle">O convite expira em 7 dias e só pode ser aceito pelo e-mail informado.</p>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.emailQueued ? (
        <div className="success-box">
          <strong>Convite enviado por e-mail.</strong>
          <p className="muted">A entrega é processada com retentativas pelo worker.</p>
        </div>
      ) : null}
      {inviteUrl ? (
        <div className="success-box">
          <strong>Prévia local do convite.</strong>
          <p className="muted">Este link aparece apenas no ambiente de desenvolvimento.</p>
          <input aria-label="Link do convite" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
            Copiar link
          </button>
        </div>
      ) : null}
      <form action={action}>
        <label htmlFor="invite-email">E-mail</label>
        <input id="invite-email" name="email" type="email" required maxLength={254} />
        <label htmlFor="invite-role">Papel</label>
        <select id="invite-role" name="role" defaultValue="OPERATOR">
          <option value="FINANCE_ADMIN">Administrador financeiro</option>
          <option value="OPERATOR">Operador</option>
          <option value="ACCOUNTANT">Contador</option>
          <option value="VIEWER">Consulta</option>
        </select>
        <SubmitButton />
      </form>
    </div>
  );
}
