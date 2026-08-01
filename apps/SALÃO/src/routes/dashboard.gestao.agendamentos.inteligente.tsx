import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { brl, useSalon } from "@/lib/salon-store";
import { today } from "@/lib/salon-seed";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/gestao/agendamentos/inteligente")({
  component: Inteligente,
});

const automations = [
  { id: "a1", name: "Rebook automático", desc: "Convida o cliente para reagendar 3 dias após o atendimento." },
  { id: "a2", name: "Preencher janelas vazias", desc: "Oferece horários ociosos com 10% off para clientes próximos." },
  { id: "a3", name: "Lembrete de confirmação", desc: "WhatsApp 24h antes pedindo confirmação." },
  { id: "a4", name: "Resgate de clientes em risco", desc: "Dispara oferta após 45 dias sem visita." },
];

function Inteligente() {
  const { appointments, clients } = useSalon();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ a1: true, a3: true });
  const atRisk = clients.filter((c) => c.tags.includes("Em risco"));
  const todays = appointments.filter((a) => a.date === today());
  const gaps = Math.max(0, 12 - todays.length);
  const potential = gaps * 160;

  return (
    <>
      <PageHeader title="Agenda inteligente" subtitle="Leitura de rebook, janelas e clientes em risco" />

      <section className="mb-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Janelas ociosas hoje" value={String(gaps)} hint={`Potencial ${brl(potential)}`} tone="primary" />
        <StatCard label="Clientes em risco" value={String(atRisk.length)} hint="Sem visita há 45+ dias" tone="warning" />
        <StatCard label="Taxa de rebook" value="62%" hint="+8 p.p. no mês" tone="success" />
        <StatCard label="No-show" value="4%" hint="Meta: abaixo de 5%" />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg font-medium">Clientes para resgatar</h2>
          <div className="space-y-3">
            {atRisk.map((c) => (
              <div key={c.id} className="panel flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Última visita {c.lastVisit} · {c.visits} atendimentos · {brl(c.totalSpent)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.success(`Convite enviado para ${c.name}`)}>
                  Enviar convite
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-medium">Automações da agenda</h2>
          <div className="space-y-3">
            {automations.map((a) => (
              <div key={a.id} className="panel flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <Switch
                  checked={!!enabled[a.id]}
                  onCheckedChange={(v) => {
                    setEnabled((p) => ({ ...p, [a.id]: v }));
                    toast.success(`${a.name} ${v ? "ativada" : "desativada"}`);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}