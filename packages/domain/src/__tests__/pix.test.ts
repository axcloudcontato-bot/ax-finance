import { describe, expect, it } from "vitest";
import { buildPixBrCode, crc16Ccitt, normalizePixKey } from "../titles/pix";
import { InvalidPixKeyError } from "../errors";

describe("PIX copia e cola (BR Code)", () => {
  it("usa o CRC16-CCITT do padrão", () => {
    expect(crc16Ccitt("123456789")).toBe("29B1");
  });

  it("reproduz o exemplo do manual do Banco Central", () => {
    expect(buildPixBrCode({ key: "123e4567-e12b-12d1-a456-426655440000", receiverName: "Fulano de Tal", city: "BRASILIA" }))
      .toBe("00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D");
  });

  it("leva valor, descrição e identificador, sem acento e dentro dos limites", () => {
    const code = buildPixBrCode({ key: "contato@empresa.com.br", receiverName: "Padaria São João Ltda Matriz Centro", city: "São José dos Campos", amountCents: 123456n, txid: "abc-123", description: "Mensalidade outubro/2026" });
    expect(code).toContain("5407" + "1234.56");
    expect(code).toContain("5925Padaria Sao Joao Ltda Mat");
    expect(code).toContain("6015Sao Jose dos Ca");
    expect(code).toContain("0224Mensalidade outubro 2026");
    expect(code).toContain("62100506abc123");
    expect(code.slice(-4)).toBe(crc16Ccitt(code.slice(0, -4)));
  });

  it("normaliza e valida as chaves", () => {
    expect(normalizePixKey("529.982.247-25")).toEqual({ key: "52998224725", type: "CPF" });
    expect(normalizePixKey("11.222.333/0001-81")).toEqual({ key: "11222333000181", type: "CNPJ" });
    expect(normalizePixKey("(11) 98765-4321")).toEqual({ key: "+5511987654321", type: "PHONE" });
    expect(normalizePixKey("+55 11 98765-4321")).toEqual({ key: "+5511987654321", type: "PHONE" });
    expect(normalizePixKey("Fulano@Empresa.com")).toEqual({ key: "fulano@empresa.com", type: "EMAIL" });
    expect(normalizePixKey("111.111.111-11")).toBeNull();
    expect(normalizePixKey("qualquer coisa")).toBeNull();
    expect(() => buildPixBrCode({ key: "x", receiverName: "A", city: "B" })).toThrow(InvalidPixKeyError);
  });
});
