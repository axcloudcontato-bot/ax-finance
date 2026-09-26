import Link from "next/link";
import { redirect } from "next/navigation";
import { listParties } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { requirePrimaryCompany } from "@/lib/company";
import { createPartyAction } from "./actions";

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const company = await requirePrimaryCompany(user.id);

  const parties = await listParties(user.id, company.id);

  return (
    <main className="wide">
      <h1 style={{ marginBottom: "1rem" }}>Clientes e fornecedores</h1>

      <div className="split">
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

        <div className="card">
          <h1>Nova pessoa</h1>
          <p className="subtitle">
            Cadastro unificado — a mesma pessoa pode ser cliente e fornecedor ao mesmo tempo
            (Seção 10).
          </p>

          {searchParams.erro ? <p className="error">{searchParams.erro}</p> : null}

          <form action={createPartyAction}>
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" type="text" required maxLength={200} />

            <label htmlFor="tradeName">Nome fantasia (opcional)</label>
            <input id="tradeName" name="tradeName" type="text" maxLength={200} />

            <label htmlFor="document">CPF/CNPJ (opcional)</label>
            <input id="document" name="document" type="text" maxLength={30} />

            <label htmlFor="email">E-mail (opcional)</label>
            <input id="email" name="email" type="email" maxLength={200} />

            <label htmlFor="phone">Telefone (opcional)</label>
            <input id="phone" name="phone" type="text" maxLength={30} />

            <label htmlFor="address">Endereço (opcional)</label>
            <input id="address" name="address" type="text" maxLength={500} />

            <label htmlFor="responsibleName">Responsável (opcional)</label>
            <input id="responsibleName" name="responsibleName" type="text" maxLength={200} />

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

            <button type="submit">Criar pessoa</button>
          </form>
        </div>
      </div>
    </main>
  );
}
