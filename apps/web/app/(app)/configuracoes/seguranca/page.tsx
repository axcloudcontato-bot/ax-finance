import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck, Smartphone, TriangleAlert } from "@/components/ui/animated-icons";
import { getMfaStatus, getPendingMfaSetup, listTrustedDevices } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { beginMfaSetupAction, confirmMfaSetupAction, disableMfaAction, revokeAllTrustedDevicesAction, revokeTrustedDeviceAction } from "./actions";
import { ConfirmMfaForm } from "./confirm-mfa-form";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function SecurityPage(
  props: {
    searchParams: Promise<{ erro?: string; configurando?: string; desativado?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const status = await getMfaStatus(user.id);
  const trustedDevices = status.enabled ? await listTrustedDevices(user.id) : [];
  const pending = !status.enabled ? await getPendingMfaSetup(user.id) : null;
  const qrCode = pending ? await QRCode.toDataURL(pending.otpauthUri, { width: 220, margin: 1 }) : null;

  return (
    <main className="wide settings-page">
      <div className="page-header">
        <div><h1>Segurança da conta</h1><p className="subtitle">Proteja seu acesso ao AX Finance.</p></div>
      </div>
      {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}
      {searchParams.desativado ? <p className="success-box">Autenticação em duas etapas desativada.</p> : null}

      <div className="settings-grid security-settings-grid">
        <section className="card settings-panel security-primary-card">
          <div className="settings-panel-header">
            <span className="settings-icon teal"><ShieldCheck className="size-5" /></span>
            <div><h2>Autenticação em duas etapas</h2><p>Adicione uma confirmação temporária aos seus próximos acessos.</p></div>
          </div>
          {status.enabled ? (
            <>
              <div className="security-state-card">
                <p className="security-status"><span className="security-status-dot" /> Proteção ativa</p>
                <span>Desde {status.enabledAt?.toLocaleDateString("pt-BR")}</span>
                <span>{status.recoveryCodesRemaining} código(s) de recuperação disponível(is)</span>
              </div>
              <div className="trusted-devices">
                <h3>Dispositivos confiáveis</h3>
                {trustedDevices.length === 0 ? (
                  <p className="muted">Nenhum. Ao entrar, marque &ldquo;Confiar neste dispositivo&rdquo; para não digitar o código a cada acesso.</p>
                ) : (
                  <>
                    <ul>
                      {trustedDevices.map((device) => (
                        <li key={device.id}>
                          <div>
                            <strong>{device.label}</strong>
                            <span>Último acesso em {(device.lastUsedAt ?? device.createdAt).toLocaleDateString("pt-BR")} · vale até {device.expiresAt.toLocaleDateString("pt-BR")}</span>
                          </div>
                          <form action={revokeTrustedDeviceAction}>
                            <input type="hidden" name="deviceId" value={device.id} />
                            <SubmitButton className="secondary">Remover</SubmitButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                    {trustedDevices.length > 1 ? <form action={revokeAllTrustedDevicesAction}><SubmitButton className="secondary">Remover todos</SubmitButton></form> : null}
                  </>
                )}
              </div>
              <details className="security-danger-zone">
                <summary><TriangleAlert className="size-4" /> Desativar autenticação em duas etapas</summary>
                <form action={disableMfaAction} className="security-disable-form">
                  <div><label htmlFor="current-password">Senha atual</label><input id="current-password" name="password" type="password" autoComplete="current-password" required /></div>
                  <div><label htmlFor="disable-code">Código do autenticador ou de recuperação</label><input id="disable-code" name="code" autoComplete="one-time-code" required /></div>
                  <SubmitButton className="danger-button">Desativar proteção</SubmitButton>
                </form>
              </details>
            </>
          ) : pending && qrCode ? (
            <>
              <div className="security-step"><span>1</span><div><strong>Conecte o autenticador</strong><p>Leia o QR code ou use a chave manual.</p></div></div>
              <div className="mfa-setup">
                <img className="mfa-qr" src={qrCode} alt="QR code para configurar o autenticador" width={220} height={220} />
                <div><p className="muted">Chave para configuração manual:</p><code className="mfa-secret">{pending.secret}</code><p className="muted">Compatível com Google Authenticator, Microsoft Authenticator, 1Password e aplicativos TOTP.</p></div>
              </div>
              <div className="security-step"><span>2</span><div><strong>Confirme o código</strong><p>Digite o código gerado para concluir a proteção.</p></div></div>
              <ConfirmMfaForm action={confirmMfaSetupAction} />
            </>
          ) : (
            <div className="security-empty-state">
              <Smartphone className="size-10" />
              <div><h3>Proteção adicional desativada</h3><p>Além da senha, você confirmará o acesso com um código temporário gerado no celular.</p></div>
              <form action={beginMfaSetupAction}><SubmitButton>Configurar autenticação em duas etapas</SubmitButton></form>
            </div>
          )}
        </section>

        <aside className="card settings-panel security-info-card">
          <span className="settings-icon"><KeyRound className="size-5" /></span>
          <h2>Como sua conta fica protegida</h2>
          <ul className="settings-feature-list">
            <li><strong>Código temporário</strong><span>Gerado no celular e renovado periodicamente.</span></li>
            <li><strong>Recuperação segura</strong><span>Códigos de uso único para perda do autenticador.</span></li>
            <li><strong>Sessões revogáveis</strong><span>Uma redefinição de senha encerra acessos anteriores.</span></li>
          </ul>
          <p className="settings-info-note">Guarde os códigos de recuperação fora deste computador e nunca os compartilhe.</p>
        </aside>
      </div>
    </main>
  );
}
