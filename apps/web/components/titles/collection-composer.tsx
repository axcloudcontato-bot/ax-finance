"use client";

import { useId, useState } from "react";
import { mailtoHref, whatsappHref } from "@/lib/collection-message";
import { CopyButton } from "./copy-button";

/**
 * Texto da cobrança editável. Copiar, WhatsApp e e-mail usam sempre o texto como está na tela, então
 * o ajuste feito aqui é o que chega ao cliente.
 */
export function CollectionComposer({
  message,
  email,
  phone,
  pixCode,
}: {
  message: { subject: string; body: string };
  email: string | null;
  phone: string | null;
  pixCode?: string | null;
}) {
  const [body, setBody] = useState(message.body);
  const fieldId = useId();
  const edited = body !== message.body;
  const mail = mailtoHref(email, { subject: message.subject, body });

  return (
    <section className="collection-message" aria-labelledby={`${fieldId}-title`}>
      <div className="collection-section-head">
        <h3 id={`${fieldId}-title`}>Mensagem</h3>
        {edited ? (
          <button type="button" className="collection-reset" onClick={() => setBody(message.body)}>Restaurar texto original</button>
        ) : (
          <small>Edite à vontade antes de enviar</small>
        )}
      </div>
      <label htmlFor={fieldId} className="sr-only">Mensagem de cobrança</label>
      <textarea id={fieldId} className="collection-text" value={body} onChange={(event) => setBody(event.target.value)} rows={11} spellCheck />
      <p className="collection-subject"><span>Assunto do e-mail</span> {message.subject}</p>
      <div className="collection-send">
        <CopyButton text={body} label="Copiar mensagem" />
        <a className="button-link secondary" href={whatsappHref(phone, body, pixCode)} target="_blank" rel="noopener noreferrer">
          {phone ? "Enviar no WhatsApp" : "Abrir no WhatsApp"}
        </a>
        {mail ? <a className="button-link secondary" href={mail}>Abrir no e-mail</a> : null}
      </div>
      {mail ? null : <small className="collection-hint">Cliente sem e-mail cadastrado: copie a mensagem ou use o WhatsApp.</small>}
    </section>
  );
}
