import { Bell, CalendarClock, FileCheck2, Users } from "lucide-react";
import { ActivitiesCard } from "./activities-card";

export default function ActivitiesCardDemo() {
  return (
    <ActivitiesCard
      headerIcon={<Bell className="size-6 text-gray-500" />}
      title="Atividades"
      subtitle="3 novas atualizações"
      activities={[
        { icon: <CalendarClock className="size-5" />, title: "Conta vence hoje", desc: "Aluguel do escritório", time: "agora" },
        { icon: <FileCheck2 className="size-5" />, title: "Importação concluída", desc: "Extrato de outubro", time: "2 h" },
        { icon: <Users className="size-5" />, title: "Convite aceito", desc: "Maria entrou na empresa", time: "ontem" },
      ]}
    />
  );
}
