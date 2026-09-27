import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { getMfaStatus, getPendingMfaSetup } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { beginMfaSetupAction, confirmMfaSetupAction, disableMfaAction } from "./actions";
import { ConfirmMfaForm } from "./confirm-mfa-form";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: { erro?: string; configurando?: string; desativado?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const status = await getMfaStatus(user.id);
  const pending = !status.enabled ? await getPendingMfaSetup(user.id) : null;
  const qrCode = pending ? await QRCode.toDataURL(pending.otpauthUri, { width: 220, margin: 1 }) : null;

  return (
    <main className="narrow">
      <div className="page-header">
        <div><h1>Segurança da conta</h1><p className="subtitle">Proteja seu acesso ao AX Finance.</p></div>
      </div>
      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.desativado ? <p className="success-box">Autenticação em duas etapas desativada.</p> : null}

      <section className="card">
        <h1>Autenticação em duas etapas</h1>
        {status.enabled ? (
          <>
            <p className="security-status"><span className="security-status-dot" /> Ativa desde {status.enabledAt?.toLocaleDateString("pt-BR")}</p>
            <p className="muted">Códigos de recuperação disponíveis: {status.recoveryCodesRemaining}. O autenticador será solicitado nos próximos acessos.</p>
            <details className="security-danger-zone">
              <summary>Desativar autenticação em duas etapas</summary>
              <form action={disableMfaAction}>
                <label htmlFor="current-password">Senha atual</label>
                <input id="current-password" name="password" type="password" autoComplete="current-password" required />
                <label htmlFor="disable-code">Código do autenticador ou de recuperação</label>
                <input id="disable-code" name="code" autoComplete="one-time-code" required />
                <button className="danger-button" type="submit">Desativar proteção</button>
              </form>
            </details>
          </>
        ) : pending && qrCode ? (
          <>
            <p>1. Abra seu aplicativo autenticador e leia o QR code.</p>
            <div className="mfa-setup">
              <img className="mfa-qr" src={qrCode} alt="QR code para configurar o autenticador" width={220} height={220} />
              <div>
                <p className="muted">Se não puder ler o QR code, informe esta chave manualmente:</p>
                <code className="mfa-secret">{pending.secret}</code>
                <p className="muted">Compatível com Google Authenticator, Microsoft Authenticator, 1Password e aplicativos TOTP.</p>
              </div>
            </div>
            <p>2. Digite abaixo o código gerado para concluir.</p>
            <ConfirmMfaForm action={confirmMfaSetupAction} />
          </>
        ) : (
          <>
            <p>Além da senha, você confirmará o acesso com um código temporário gerado no celular.</p>
            <p className="muted">A ativação gera códigos de recuperação para você guardar caso perca o autenticador.</p>
            <form action={beginMfaSetupAction}><button type="submit">Configurar autenticação em duas etapas</button></form>
          </>
        )}
      </section>
    </main>
  );
}
