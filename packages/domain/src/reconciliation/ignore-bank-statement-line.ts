import { z } from "zod";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { BankStatementLineAlreadyProcessedError, BankStatementLineNotFoundError } from "../errors";

export const ignoreBankStatementLineInput = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function ignoreBankStatementLine(userId: string, companyId: string, lineId: string, input: unknown) {
  const data = ignoreBankStatementLineInput.parse(input);
  await assertActiveMembership(userId, companyId);

  return withCompanyContext(userId, companyId, async (tx) => {
    const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, companyId } });
    if (!line) {
      throw new BankStatementLineNotFoundError();
    }
    if (line.status !== "PENDING") {
      throw new BankStatementLineAlreadyProcessedError();
    }

    return tx.bankStatementLine.update({
      where: { id: lineId },
      data: { status: "IGNORED", ignoreReason: data.reason },
    });
  });
}
