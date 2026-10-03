import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "@/components/ui/animated-icons";
import { listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { Modal } from "@/components/ui/modal";
import { createPartyAction } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function PessoasPage(
  props: {
    searchParams: Promise<{ erro?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const parties = await listParties(user.id, company.id);

  return (
    <main className="wide">
      <div className="page-header">
        <h1>Clientes e fornecedores</h1>
        <Modal
          triggerLabel="+ Nova pessoa"
          title="Nova pessoa"
          icon={<UserPlus className="size-5" strokeWidth={1.5} />}
          maxWidth="680px"
        >
          <p className="subtitle">
            Cadastro unificado — a mesma pessoa pode ser cliente e fornecedor ao mesmo tempo
            (Seção 10).
          </p>

          {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

          <form action={createPartyAction}>
            <div className="form-grid">
              <div>
                <label htmlFor="name">Nome</label>
                <input id="name" name="name" type="text" required maxLength={200} />
              </div>

              <div>
                <label htmlFor="tradeName">Nome fantasia (opcional)</label>
                <input id="tradeName" name="tradeName" type="text" maxLength={200} />
              </div>

              <div>
                <label htmlFor="document">CPF/CNPJ (opcional)</label>
                <input id="document" name="document" type="text" maxLength={30} />
              </div>

              <div>
                <label htmlFor="email">E-mail (opcional)</label>
                <input id="email" name="email" type="email" maxLength={200} />
              </div>

              <div>
                <label htmlFor="phone">Telefone (opcional)</label>
                <input id="phone" name="phone" type="text" maxLength={30} />
              </div>

              <div>
                <label htmlFor="responsibleName">Responsável (opcional)</label>
                <input id="responsibleName" name="responsibleName" type="text" maxLength={200} />
              </div>

              <div className="span-2">
                <label htmlFor="address">Endereço (opcional)</label>
                <input id="address" name="address" type="text" maxLength={500} />
              </div>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem" }}>
              <label
                htmlFor="isClient"
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}
              >
                <input
                  id="isClient"
                  name="isClient"
                  type="checkbox"
                  value="true"
                  style={{ width: "auto" }}
                />
                Cliente
              </label>
              <label
                htmlFor="isSupplier"
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}
              >
                <input
                  id="isSupplier"
                  name="isSupplier"
                  type="checkbox"
                  value="true"
                  style={{ width: "auto" }}
                />
                Fornecedor
              </label>
            </div>

            <label htmlFor="notes">Observações (opcional)</label>
            <input id="notes" name="notes" type="text" maxLength={2000} />

            <SubmitButton>Criar pessoa</SubmitButton>
          </form>
        </Modal>
      </div>

      <div className="card">
        {parties.length === 0 ? (
          <p className="muted">Nenhuma pessoa cadastrada ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Papel</th>
                <th>Documento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => (
                <tr key={party.id}>
                  <td>
                    <Link href={`/cadastros/pessoas/${party.id}`}>{party.name}</Link>
                  </td>
                  <td>
                    {[party.isClient ? "Cliente" : null, party.isSupplier ? "Fornecedor" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td>{party.document ?? "—"}</td>
                  <td>{party.status === "ACTIVE" ? "Ativa" : "Inativa"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
