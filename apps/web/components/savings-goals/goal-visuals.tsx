"use client";

import {
  Airplane01Icon,
  Briefcase01Icon,
  Car01Icon,
  GiftIcon,
  HealthIcon,
  Home01Icon,
  Mortarboard01Icon,
  PiggyBankIcon,
  Shield01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export const GOAL_ICONS = {
  piggy: { icon: PiggyBankIcon, label: "Cofrinho" },
  plane: { icon: Airplane01Icon, label: "Viagem" },
  home: { icon: Home01Icon, label: "Casa" },
  car: { icon: Car01Icon, label: "Carro" },
  shield: { icon: Shield01Icon, label: "Reserva de emergência" },
  gift: { icon: GiftIcon, label: "Presente" },
  education: { icon: Mortarboard01Icon, label: "Estudos" },
  health: { icon: HealthIcon, label: "Saúde" },
  briefcase: { icon: Briefcase01Icon, label: "Negócio" },
  star: { icon: StarIcon, label: "Sonho" },
} as const;

export const GOAL_COLORS = {
  blue: "Azul",
  green: "Verde",
  purple: "Roxo",
  orange: "Laranja",
  pink: "Rosa",
  teal: "Turquesa",
  yellow: "Amarelo",
  red: "Vermelho",
} as const;

export type GoalIconKey = keyof typeof GOAL_ICONS;
export type GoalColorKey = keyof typeof GOAL_COLORS;

/** Selo redondo com o ícone do cofrinho, na cor dele. */
export function GoalBadge({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  const entry = GOAL_ICONS[icon as GoalIconKey] ?? GOAL_ICONS.piggy;
  return (
    <span className={`goal-badge goal-color-${color}`} style={{ width: size, height: size }} aria-hidden="true">
      <HugeiconsIcon icon={entry.icon} size={Math.round(size * 0.5)} strokeWidth={1.8} />
    </span>
  );
}

/** Escolha de ícone e cor no formulário: botões de opção visuais, um grupo para cada. */
export function GoalAppearancePicker({ idPrefix, icon, color }: { idPrefix: string; icon: string; color: string }) {
  return (
    <>
      <fieldset className="goal-picker">
        <legend>Ícone</legend>
        <div className="goal-picker-options">
          {(Object.keys(GOAL_ICONS) as GoalIconKey[]).map((key) => (
            <label key={key} className="goal-picker-icon" title={GOAL_ICONS[key].label}>
              <input type="radio" name="icon" value={key} defaultChecked={icon === key} id={`${idPrefix}-icon-${key}`} />
              <span><HugeiconsIcon icon={GOAL_ICONS[key].icon} size={20} strokeWidth={1.8} /></span>
              <span className="sr-only">{GOAL_ICONS[key].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="goal-picker">
        <legend>Cor</legend>
        <div className="goal-picker-options">
          {(Object.keys(GOAL_COLORS) as GoalColorKey[]).map((key) => (
            <label key={key} className={`goal-picker-color goal-color-${key}`} title={GOAL_COLORS[key]}>
              <input type="radio" name="color" value={key} defaultChecked={color === key} id={`${idPrefix}-color-${key}`} />
              <span />
              <span className="sr-only">{GOAL_COLORS[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
