import {
  AirplaneTilt, AppWindow, ArrowUUpLeft, ArrowsLeftRight, Baby, Bank, BookOpen, Briefcase, Buildings, Bus, Car, ChartLineUp,
  Coins, Confetti, CreditCard, Desktop, DeviceMobile, Drop, FirstAidKit, Flame, ForkKnife, GasPump, Gift, GraduationCap, HandCoins,
  Factory, Handshake, House, Lightning, Megaphone, Money, Package, Paperclip, PawPrint, Percent, PiggyBank, Pill, Receipt,
  ShoppingCart, Sparkle, Storefront, TShirt, Tag, TelevisionSimple, TrendUp, Users, UsersThree, Wallet, WifiHigh, Wrench,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * Ícone da categoria pelo nome (Aluguel → casa, Água → gota, Luz → raio…), em traço fino (peso
 * "light" do Phosphor). Sem palavra reconhecida, vale o ícone da natureza: receita, despesa ou outra.
 * As regras mais específicas vêm primeiro ("imposto de renda" antes de "renda").
 */
const RULES: [RegExp, Icon][] = [
  [/financiamento|emprestimo|divida/, HandCoins],
  [/imposto|iptu|tribut|\btaxas?\b|darf|\bdas\b/, Receipt],
  [/ipva|veiculo|carro|moto|estacionamento|pedagio|seguro/, Car],
  [/material de escritorio|papelaria/, Paperclip],
  [/aluguel|moradia|\bcasa\b|imovel/, House],
  [/condominio|administrativ|escritorio|predio/, Buildings],
  [/\bagua\b|saneamento/, Drop],
  [/\bluz\b|energia|eletric/, Lightning],
  [/\bgas\b(?!olina)/, Flame],
  [/internet|wi-?fi|banda larga/, WifiHigh],
  [/telefone|celular/, DeviceMobile],
  [/manutencao|reparo|conserto|instalac/, Wrench],
  [/supermercado|mercado|feira|hortifruti/, ShoppingCart],
  [/restaurante|delivery|alimentac|comida|lanche|refeic/, ForkKnife],
  [/combustivel|gasolina|etanol|posto/, GasPump],
  [/transporte|onibus|metro|aplicativo|uber|taxi/, Bus],
  [/farmacia|remedio|medicament/, Pill],
  [/saude|medic|consulta|exame|odonto|dentista|hospital/, FirstAidKit],
  [/escola|faculdade|universidade|educac/, GraduationCap],
  [/curso|livro|treinamento/, BookOpen],
  [/viage|passage|hotel|hospedagem/, AirplaneTilt],
  [/assinatura|streaming|netflix|spotify/, TelevisionSimple],
  [/lazer|entretenimento|diversao|passeio/, Confetti],
  [/vestuario|roupa|calcado/, TShirt],
  [/cuidados pessoais|beleza|salao|estetica/, Sparkle],
  [/presente|doac/, Gift],
  [/familia/, UsersThree],
  [/filho|crianca|bebe/, Baby],
  [/\bpets?\b|animal|veterinar/, PawPrint],
  [/tarifa|banc|financeir/, Bank],
  [/juros|multa/, Percent],
  [/cartao|fatura/, CreditCard],
  [/reserva|cofrinho|poupanca|previdencia/, PiggyBank],
  [/investimento|aporte|aplicac|rendimento/, ChartLineUp],
  [/encargo|folha|pessoal|mao de obra|beneficio|funcionario/, Users],
  [/salario|holerite|pro-?labore/, Wallet],
  [/reembolso|devoluc|estorno/, ArrowUUpLeft],
  [/renda extra|avulso|freela|bico/, Coins],
  [/comiss/, Handshake],
  [/venda|loja|comerci/, Storefront],
  [/marketing|publicidade|anuncio|propaganda/, Megaphone],
  [/custo|producao|fabrica/, Factory],
  [/materia|insumo|estoque|mercadoria/, Package],
  [/equipamento|computador|maquina/, Desktop],
  [/software|licenc|sistema/, AppWindow],
  [/servic|consultoria|projeto|trabalho/, Briefcase],
  [/receita|renda|entrada/, Money],
];

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function categoryIconFor(name: string, nature: string): Icon {
  const text = normalize(name);
  const found = RULES.find(([pattern]) => pattern.test(text));
  if (found) return found[1];
  if (nature === "OPERATING_REVENUE") return TrendUp;
  if (nature === "TECHNICAL_TRANSFER") return ArrowsLeftRight;
  return Tag;
}

/** Quadro com o ícone da categoria, no tom da natureza (receita em verde, despesa neutra). */
export function CategoryIcon({ name, nature, size = 18 }: { name: string; nature: string; size?: number }) {
  const Glyph = categoryIconFor(name, nature);
  const kind = nature === "OPERATING_REVENUE" ? "revenue" : nature === "TECHNICAL_TRANSFER" ? "other" : "expense";
  return (
    <span className={`category-icon is-${kind}`} aria-hidden="true">
      <Glyph size={size} weight="light" />
    </span>
  );
}
