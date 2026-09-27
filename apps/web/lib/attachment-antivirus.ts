import net from "node:net";

export type AttachmentScanResult = { status: "CLEAN" | "NOT_SCANNED"; scannedAt?: Date };

function scanRequired() {
  return process.env.ATTACHMENT_SCAN_REQUIRED?.trim().toLowerCase() === "true";
}

export async function checkAttachmentScannerReady() {
  if (!scanRequired()) return;
  const host = process.env.CLAMAV_HOST?.trim();
  if (!host) throw new Error("CLAMAV_HOST não configurado.");
  const port = Number(process.env.CLAMAV_PORT || "3310");
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(3_000, () => socket.destroy(new Error("tempo limite do antivírus excedido")));
    socket.once("connect", () => { socket.end(); resolve(); });
    socket.once("error", reject);
  });
}

export async function scanAttachment(buffer: Buffer): Promise<AttachmentScanResult> {
  const host = process.env.CLAMAV_HOST?.trim();
  if (!host) {
    if (scanRequired()) throw new Error("Antivírus obrigatório, mas CLAMAV_HOST não está configurado.");
    return { status: "NOT_SCANNED" };
  }
  const port = Number(process.env.CLAMAV_PORT || "3310");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CLAMAV_PORT inválida.");

  const response = await new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    const fail = (error: Error) => { socket.destroy(); reject(new Error(`Falha ao verificar o anexo: ${error.message}`)); };
    socket.setTimeout(15_000, () => fail(new Error("tempo limite excedido")));
    socket.on("error", fail);
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim()));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buffer.length; offset += 1024 * 1024) {
        const chunk = buffer.subarray(offset, Math.min(offset + 1024 * 1024, buffer.length));
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });

  if (response.endsWith("OK")) return { status: "CLEAN", scannedAt: new Date() };
  if (response.includes("FOUND")) throw new Error("O arquivo foi rejeitado pelo antivírus.");
  throw new Error("O antivírus não conseguiu validar o arquivo.");
}
