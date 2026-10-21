/**
 * Aplica o tema salvo (ou o do sistema) antes da primeira pintura, para não piscar o tema errado.
 * Usado no app autenticado e nas telas de acesso (login e confirmação em duas etapas).
 */
export const THEME_BOOTSTRAP = `try{var p=localStorage.getItem("ax-finance:theme:v1");var t=p==="dark"||p==="light"?p:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.dataset.axTheme=t;r.style.colorScheme=t}catch(e){}`;
