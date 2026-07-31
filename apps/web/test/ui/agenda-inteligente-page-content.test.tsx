// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    className?: string;
    href: string;
  }) =>
    createElement(
      "a",
      {
        className: props.className,
        href: props.href,
      },
      props.children,
    ),
}));

import { AgendaIntelligencePageContent } from "@/app/dashboard/gestao/agendamentos/inteligente/_components";

describe("AgendaIntelligencePageContent", () => {
  it("renders sync, fill, and recovery sections for the smart agenda module", () => {
    render(
      <AgendaIntelligencePageContent
        data={{
          aiEnabled: true,
          agendaHref: "/dashboard/gestao/agendamentos?day=2026-05-13",
          campaignQuestion: "Preencher agenda de hoje com IA",
          dayKey: "2026-05-13",
          dayLabel: "Quarta-feira, 13 de maio",
          fillSignals: [
            {
              id: "occupancy",
              label: "Ocupação do dia",
              note: "3 horários ainda livres na leitura atual.",
              value: "58%",
            },
            {
              id: "vacancies",
              label: "Vagas abertas",
              note: "Um cancelamento abriu espaço na tarde.",
              value: "2",
            },
          ],
          fillSummary:
            "Encontrei 2 janelas com potencial de encaixe e 7 clientes em momento de retorno para agir com precisão.",
          nextDayHref:
            "/dashboard/gestao/agendamentos/inteligente?day=2026-05-14",
          opportunities: [
            {
              agendaHref: "/dashboard/gestao/agendamentos?day=2026-05-13",
              compatibleServiceCount: 3,
              compatibleServices: [
                "Escova • 45 min • Cabelo",
                "Corte feminino • 60 min • Cabelo",
              ],
              detail:
                "Cabe mais uma cliente sem mexer no restante da grade da profissional.",
              gapLabel: "Entre atendimentos",
              headline: "Há espaço livre às 15:00 na agenda de hoje.",
              id: "opportunity-1",
              staffName: "Camila",
              suggestedServiceLabel: "Escova • Cabelo",
              windowLabel: "15:00 às 15:45",
            },
          ],
          previousDayHref:
            "/dashboard/gestao/agendamentos/inteligente?day=2026-05-12",
          recoverySnapshot: {
            available: true,
            candidateCount: 8,
            dayLabel: "amanhã",
            headline: "3 horário(s) ocioso(s) detectado(s) em amanhã",
            highChanceCount: 4,
            openSlotsCount: 3,
            serviceName: "Escova",
            staffName: "Camila",
            summary:
              "Camila tem 14:00 às 16:00 com foco em Escova. 8 clientes entram na lista sugerida.",
            topChanceLabel: "Alta",
            windowLabel: "14:00 às 16:00",
          },
          syncSources: [
            {
              id: "salon-schedule",
              label: "Agenda do salão",
              note: "08:00 às 19:00 • passo de 30 min",
              status: "Sincronizada para o dia",
              tone: "success",
            },
            {
              id: "team",
              label: "Profissionais em operação",
              note: "Camila, Ricardo e Julia",
              status: "3 profissionais no dia de 4",
              tone: "accent",
            },
          ],
          syncSummary:
            "A agenda já cruza horário do salão, equipe disponível, serviços ligados e ajustes do dia antes de liberar encaixe.",
          workflow: [
            {
              id: "sync",
              title: "1. Agenda sincronizada",
              description:
                "O painel cruza horário do salão, profissionais, serviços habilitados e bloqueios.",
            },
            {
              id: "detect",
              title: "2. IA detecta oportunidade",
              description:
                "A leitura aponta a melhor janela, o profissional certo e a base com maior chance de voltar.",
            },
            {
              id: "confirm",
              title: "3. Você confirma e executa",
              description:
                "Nada dispara sozinho. A IA sugere e você confirma antes de agir.",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Sincronização de agenda e preenchimento de horários",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Leitura operacional antes de vender horário",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Oportunidades prontas para revisão",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Agenda do salão")).toBeInTheDocument();
    expect(screen.getByText("Profissionais em operação")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Campanha para preencher horários",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar sugestão" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Há espaço livre às 15:00 na agenda de hoje.")).toBeInTheDocument();
    expect(screen.getByText("1. Agenda sincronizada")).toBeInTheDocument();
  });
});
