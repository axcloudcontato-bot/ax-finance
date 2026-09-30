import { redirect } from "next/navigation";
import { listCompaniesForUser } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { onboardingAction } from "./actions";

export default async function OnboardingPage(
  props: {
    searchParams: Promise<{ erro?: string; plano?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const companies = await listCompaniesForUser(user.id);
  if (companies.length > 0) {
    redirect(`/dashboard?empresa=${companies[0]!.id}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const selectedPlan = searchParams.plano?.toUpperCase() === "PERSONAL" ? "PERSONAL" : "ESSENTIAL";

  return (
    <main className="narrow">
      <div className="card">
        <h1>Vamos configurar sua gestão</h1>
        <p className="subtitle">
          Escolha a versão, crie seu espaço e a primeira conta com o saldo de abertura — o instante imediatamente
          anterior ao primeiro movimento que você for lançar ou importar.
        </p>

        {searchParams.erro && <p className="error">{searchParams.erro}</p>}

        <form action={onboardingAction}>
          <fieldset className="onboarding-plan-options">
            <legend>Qual versão combina com você?</legend>
            <label className="onboarding-plan-card">
              <input type="radio" name="planCode" value="PERSONAL" defaultChecked={selectedPlan === "PERSONAL"} />
              <span><strong>Gestão Pessoal</strong><small>R$ 29,90/mês</small></span>
              <em>Organização pessoal sem fechamento, auditoria, DRE ou conciliação bancária.</em>
            </label>
            <label className="onboarding-plan-card">
              <input type="radio" name="planCode" value="ESSENTIAL" defaultChecked={selectedPlan === "ESSENTIAL"} />
              <span><strong>Essencial</strong><small>R$ 59/mês</small></span>
              <em>Gestão completa com conciliação, fechamento, auditoria e DRE gerencial.</em>
            </label>
          </fieldset>

          <label htmlFor="companyName">Nome do espaço financeiro</label>
          <input id="companyName" name="companyName" type="text" required maxLength={200} />

          <label htmlFor="accountName">Nome da conta</label>
          <input
            id="accountName"
            name="accountName"
            type="text"
            required
            maxLength={200}
            placeholder="Conta corrente principal"
          />

          <label htmlFor="accountType">Tipo de conta</label>
          <select id="accountType" name="accountType" defaultValue="BANK">
            <option value="BANK">Conta bancária</option>
            <option value="CASH">Dinheiro em caixa</option>
            <option value="WALLET">Carteira de recebimentos</option>
          </select>

          <label htmlFor="openingBalance">Saldo de abertura (R$)</label>
          <input
            id="openingBalance"
            name="openingBalance"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue="0,00"
            required
          />

          <label htmlFor="openingDate">Data do saldo de abertura</label>
          <input
            id="openingDate"
            name="openingDate"
            type="date"
            defaultValue={today}
            required
          />

          <button type="submit">Criar empresa e continuar</button>
        </form>
      </div>
    </main>
  );
}
