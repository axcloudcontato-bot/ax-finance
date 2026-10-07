"use client";

import { useEffect } from "react";
import { caretAfterFormat, completeMoneyInput, formatMoneyInput } from "@/lib/money-mask";

const SELECTOR = 'input[inputmode="decimal"]';

function isMoneyInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.matches(SELECTOR) && !target.readOnly && !target.disabled;
}

/**
 * Grava o valor no campo de um jeito que o React também enxerga (campos controlados guardam o texto
 * em estado): usa o setter nativo e avisa com um novo evento "input".
 */
function writeValue(input: HTMLInputElement, value: string, notify = true) {
  if (input.value === value) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  if (notify) input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Máscara de reais para TODO campo de valor do sistema (os que têm inputmode="decimal"): milhar com
 * ponto enquanto digita, vírgula decimal, no máximo duas casas e ",00" ao sair do campo. Fica no layout
 * raiz e age por delegação de eventos, então formulários novos já nascem com o mesmo padrão.
 */
export function MoneyInputMask() {
  useEffect(() => {
    let own = false;

    function onInput(event: Event) {
      if (own || !isMoneyInput(event.target) || (event as InputEvent).isComposing) return;
      const input = event.target;
      const before = input.value;
      const pasted = (event as InputEvent).inputType === "insertFromPaste";
      const after = formatMoneyInput(before, { pasted });
      if (after === before) return;
      const caret = input.selectionStart ?? before.length;
      own = true;
      try {
        writeValue(input, after);
        const next = pasted ? after.length : caretAfterFormat(before, caret, after);
        input.setSelectionRange(next, next);
      } finally {
        own = false;
      }
    }

    function onBlur(event: Event) {
      if (!isMoneyInput(event.target)) return;
      own = true;
      try {
        writeValue(event.target, completeMoneyInput(event.target.value));
      } finally {
        own = false;
      }
    }

    // Enter com o campo ainda em foco: completa antes de ler o formulário.
    function onSubmit(event: Event) {
      if (!(event.target instanceof HTMLFormElement)) return;
      own = true;
      try {
        for (const input of event.target.querySelectorAll<HTMLInputElement>(SELECTOR)) {
          if (isMoneyInput(input)) writeValue(input, completeMoneyInput(input.value));
        }
      } finally {
        own = false;
      }
    }

    // Valores que já chegam preenchidos do servidor ("3000,00") passam a aparecer agrupados ("3.000,00").
    function normalizeInitialValues(root: ParentNode) {
      own = true;
      try {
        for (const input of root.querySelectorAll<HTMLInputElement>(SELECTOR)) {
          if (!isMoneyInput(input) || input.value === "" || input === document.activeElement) continue;
          writeValue(input, completeMoneyInput(formatMoneyInput(input.value, { pasted: true })), false);
        }
      } finally {
        own = false;
      }
    }
    normalizeInitialValues(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.matches(SELECTOR)) normalizeInitialValues(node.parentNode ?? document);
            else normalizeInitialValues(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("input", onInput);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("input", onInput);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}
