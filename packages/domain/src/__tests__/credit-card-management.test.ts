import { beforeEach, afterAll, it, expect } from "vitest";
import { registerUser } from "../identity/register";
import { createCompany } from "../companies/create-company";
import { createCategory } from "../categories/create-category";
import { createFinancialAccount } from "../financial-accounts/create-account";
import { closePeriod } from "../closures/close-period";
import { reverseSettlement } from "../titles/reverse-settlement";
import { createCreditCard, createCreditCardPurchase, listCreditCards, getCreditCard, payCreditCardInvoice, updateCreditCard, updateCreditCardPurchase, cancelCreditCardPurchase, deleteCreditCard, archiveCreditCard, summarizeCreditCardPortfolio } from "../credit-cards";
import { PeriodClosedError, IdempotencyConflictError } from "../errors";
import { rootClient, resetDatabase } from "./test-db";

beforeEach(resetDatabase);
afterAll(() => rootClient.$disconnect());
const days = { closingDay: 10, dueDay: 20 };
async function setup() {
  const user = await registerUser({email:"auditoria.local@example.test",name:"Demonstração da auditoria",password:"Auditoria-local-2026"});
  const company = await createCompany(user.id,{name:"Auditoria — dados fictícios"});
  const category = await createCategory(user.id,company.id,{name:"Compras e serviços",nature:"EXPENSE"});
  const account = await createFinancialAccount(user.id,company.id,{name:"Conta de demonstração",type:"BANK",openingBalanceCents:500000,openingDate:"2026-01-01"});
  const card = await createCreditCard(user.id,company.id,{name:"Nubank — demonstração",issuer:"NUBANK",brand:"MASTERCARD",lastDigits:"1234",limitCents:1000000,...days,defaultPaymentAccountId:account.id});
  return {user,company,category,account,card};
}
function buy(c:Awaited<ReturnType<typeof setup>>,amount:number,date="2026-01-05",extra={}) {
  return createCreditCardPurchase(c.user.id,c.company.id,{cardId:c.card.id,description:"Compra fictícia",categoryId:c.category.id,totalAmountCents:amount,purchaseDate:date,...extra});
}
it("soma todas as faturas vencidas em vez de somente a próxima",async()=>{
  const c=await setup(); await buy(c,20000,"2026-01-05"); await buy(c,30000,"2026-02-05");
  const [s]=await listCreditCards(c.user.id,c.company.id,{today:"2026-10-08"});
  expect(s!.overdueCount).toBe(2); expect(s!.nextPayable?.remainingCents).toBe(20000n); expect(s!.usedLimitCents).toBe(50000n);
  const summary=summarizeCreditCardPortfolio([s!],"2026-10-08");
  expect(summary.payableCents).toBe(50000n); expect(summary.overdueCents).toBe(50000n); expect(summary.dueSoonCents).toBe(0n);
});
it("bloqueia criação, edição, cancelamento e exclusão em período fechado",async()=>{
  const c=await setup(); const [p]=await buy(c,10000); await closePeriod(c.user.id,c.company.id,{period:"2026-01"});
  await expect(buy(c,20000)).rejects.toBeInstanceOf(PeriodClosedError);
  await expect(updateCreditCardPurchase(c.user.id,c.company.id,p!.id,{description:"Reclassificado após fechamento",categoryId:c.category.id})).rejects.toBeInstanceOf(PeriodClosedError);
  await expect(cancelCreditCardPurchase(c.user.id,c.company.id,p!.id,{reason:"Cenário de auditoria"})).rejects.toBeInstanceOf(PeriodClosedError);
  await expect(deleteCreditCard(c.user.id,c.company.id,c.card.id)).rejects.toBeInstanceOf(PeriodClosedError);
  expect(await rootClient.creditCardPurchase.count({where:{companyId:c.company.id}})).toBe(1);
});
it("repetir pagamento integral devolve o original e conteúdo diferente é recusado",async()=>{
  const c=await setup(); const [p]=await buy(c,10000);
  const input={financialAccountId:c.account.id,effectiveDate:"2026-01-20",idempotencyKey:"c1bde0ef-6208-4dd5-b2aa-d6c759f91911"};
  const original=await payCreditCardInvoice(c.user.id,c.company.id,p!.invoiceId,input);
  expect((await payCreditCardInvoice(c.user.id,c.company.id,p!.invoiceId,input)).id).toBe(original.id);
  await expect(payCreditCardInvoice(c.user.id,c.company.id,p!.invoiceId,{...input,amountCents:5000})).rejects.toBeInstanceOf(IdempotencyConflictError);
  expect(await rootClient.settlement.count({where:{companyId:c.company.id}})).toBe(1);
});
it("recusa datas inexistentes sem gravar compra ou fatura",async()=>{
  const c=await setup(); await expect(buy(c,10000,"2026-02-31")).rejects.toThrow();
  expect(await rootClient.creditCardPurchase.count({where:{companyId:c.company.id}})).toBe(0);
});
it("mantém valor e datas da fatura aberta ao trocar os dias do cartão",async()=>{
  const c=await setup(); await buy(c,10000,"2026-10-05");
  await updateCreditCard(c.user.id,c.company.id,c.card.id,{name:c.card.name,limitCents:1000000,closingDay:25,dueDay:5});
  const [s]=await listCreditCards(c.user.id,c.company.id,{today:"2026-10-08"});
  expect(s!.openCycle.totalCents).toBe(10000n); expect(s!.openCycle.closingDate).toBe("2026-10-10");
  const detail=await getCreditCard(c.user.id,c.company.id,c.card.id,{today:"2026-10-08"});
  expect(detail.invoices[0]!.stage).toBe("OPEN"); expect(detail.openCycle.dueDate).toBe("2026-10-20");
});
it("inclui dívida de cartão arquivado depois de estornar pagamento",async()=>{
  const c=await setup(); const [p]=await buy(c,10000);
  const paid=await payCreditCardInvoice(c.user.id,c.company.id,p!.invoiceId,{financialAccountId:c.account.id,effectiveDate:"2026-01-20"});
  await archiveCreditCard(c.user.id,c.company.id,c.card.id);
  await reverseSettlement(c.user.id,c.company.id,paid.id,{reason:"Cenário de auditoria"});
  const [s]=await listCreditCards(c.user.id,c.company.id,{includeArchived:true});
  expect(s!.status).toBe("ARCHIVED"); expect(s!.usedLimitCents).toBe(10000n);
  const summary=summarizeCreditCardPortfolio([s!],"2026-10-08");
  expect(summary.totalDebtCents).toBe(10000n); expect(summary.totalLimitCents).toBe(0n); expect(summary.overdueCents).toBe(10000n);
});
it("projeta parcelas em seis meses e informa compromissos além do horizonte",async()=>{
  const c=await setup(); await buy(c,120000,"2026-10-05",{installmentCount:12});
  const cards=await listCreditCards(c.user.id,c.company.id,{today:"2026-10-08"});
  const summary=summarizeCreditCardPortfolio(cards,"2026-10-08");
  expect(summary.months.map((month)=>month.referenceMonth)).toEqual(["2026-10","2026-11","2026-12","2027-01","2027-02","2027-03"]);
  expect(summary.months.map((month)=>month.remainingCents)).toEqual(Array(6).fill(10000n));
  expect(summary.dueSoonCents).toBe(10000n); expect(summary.beyondHorizonCents).toBe(60000n); expect(summary.totalDebtCents).toBe(120000n);
});

it("repetições simultâneas de pagamento parcial geram somente uma baixa", async () => {
  const c = await setup();
  const [purchase] = await buy(c, 10000);
  const input = { financialAccountId: c.account.id, effectiveDate: "2026-01-20", amountCents: 4000, idempotencyKey: "57c320e6-f2e5-47f3-9b26-4bb079f6015a" };
  const payments = await Promise.all(Array.from({ length: 3 }, () => payCreditCardInvoice(c.user.id, c.company.id, purchase!.invoiceId, input)));
  expect(new Set(payments.map((payment) => payment.id)).size).toBe(1);
  expect((await getCreditCard(c.user.id, c.company.id, c.card.id)).invoices[0]!.remainingCents).toBe(6000n);
});

it("recusa o parcelamento inteiro se uma parcela afetar período fechado", async () => {
  const c = await setup();
  await closePeriod(c.user.id, c.company.id, { period: "2026-02" });
  await expect(buy(c, 9000, "2026-01-05", { installmentCount: 3 })).rejects.toBeInstanceOf(PeriodClosedError);
  expect(await rootClient.creditCardPurchase.count({ where: { companyId: c.company.id } })).toBe(0);
  expect(await rootClient.creditCardInvoice.count({ where: { companyId: c.company.id } })).toBe(0);
});

it("um portfólio vazio mantém indicadores e calendário sem dívida", () => {
  const summary = summarizeCreditCardPortfolio([], "2026-12-15");
  expect(summary.totalDebtCents).toBe(0n);
  expect(summary.overdueCents).toBe(0n);
  expect(summary.dueSoonCents).toBe(0n);
  expect(summary.months.map((month) => month.referenceMonth)).toEqual(["2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05"]);
  expect(summary.months.every((month) => month.remainingCents === 0n)).toBe(true);
});

it("a janela de 30 dias inclui hoje e o último dia, sem incorporar vencidos ou o dia seguinte", () => {
  const dates = ["2026-10-07", "2026-10-08", "2026-11-07", "2026-11-08"];
  const summary = summarizeCreditCardPortfolio([{
    id: "cartao", name: "Cartão", status: "ACTIVE", limitCents: 100000n, usedLimitCents: 4000n,
    pendingInvoices: dates.map((dueDate, index) => ({ id: String(index), referenceMonth: dueDate.slice(0, 7), closingDate: "2026-10-01", dueDate, remainingCents: 1000n, stage: index === 0 ? "OVERDUE" : "CLOSED" })),
  }], "2026-10-08");
  expect(summary.overdueCents).toBe(1000n);
  expect(summary.dueSoonCents).toBe(2000n);
  expect(summary.totalDebtCents).toBe(4000n);
});
