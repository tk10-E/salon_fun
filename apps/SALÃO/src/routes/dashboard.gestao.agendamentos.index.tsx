import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewAppointmentDialog } from "@/components/dashboard/NewAppointmentDialog";
import { brl, formatDateBR, statusLabels, statusStyles, useSalon } from "@/lib/salon-store";
import { today } from "@/lib/salon-seed";
import { cn } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/gestao/agendamentos/")({
  component: Agenda,
});

const statuses: AppointmentStatus[] = [
  "pendente",
  "confirmado",
  "em_atendimento",
  "concluido",
  "cancelado",
  "faltou",
];

function Agenda() {
  const { appointments, clients, services, professionals, update } = useSalon();
  const [view, setView] = useState("dia");
  const [date, setDate] = useState(today());
  const [pro, setPro] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const base = new Date(date);
    return appointments
      .filter((a) => {
        const ad = new Date(a.date);
        if (view === "dia" && a.date !== date) return false;
        if (view === "semana") {
          const diff = (ad.getTime() - base.getTime()) / 86400000;
          if (diff < 0 || diff > 6) return false;
        }
        if (view === "mes" && a.date.slice(0, 7) !== date.slice(0, 7)) return false;
        if (pro !== "todos" && a.professionalId !== pro) return false;
        if (status !== "todos" && a.status !== status) return false;
        return true;
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [appointments, view, date, pro, status]);

  const setStatusOf = (id: string, s: AppointmentStatus) => {
    update("appointments", appointments.map((a) => (a.id === id ? { ...a, status: s } : a)));
    toast.success(`Status alterado para ${statusLabels[s]}`);
  };

  const togglePlan = (a: Appointment) => {
    update(
      "appointments",
      appointments.map((x) => (x.id === a.id ? { ...x, usedPlanSession: !x.usedPlanSession } : x)),
    );
    toast.success(a.usedPlanSession ? "Consumo de sessão estornado" : "Sessão do plano consumida");
  };

  const setDeposit = (a: Appointment, value: number) => {
    update("appointments", appointments.map((x) => (x.id === a.id ? { ...x, deposit: value } : x)));
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Gestão completa dos horários do salão"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Novo agendamento
          </Button>
        }
      />

      <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4">
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <Select value={pro} onValueChange={setPro}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os profissionais</SelectItem>
            {professionals.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} resultados</span>
      </div>

      <div className="space-y-4">
        {filtered.map((a) => {
          const client = clients.find((c) => c.id === a.clientId);
          const srv = services.find((s) => s.id === a.serviceId);
          return (
            <div key={a.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-20 border-r border-border pr-4">
                  <p className="text-sm font-bold">{a.time}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateBR(a.date)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{client?.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {srv?.name} · {professionals.find((p) => p.id === a.professionalId)?.name}
                  </p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-[10px] font-bold uppercase", statusStyles[a.status])}>
                  {statusLabels[a.status]}
                </span>
                <span className="text-sm font-medium">{brl(a.price)}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Select value={a.status} onValueChange={(v) => setStatusOf(a.id, v as AppointmentStatus)}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sinal</span>
                  <Input
                    type="number"
                    value={a.deposit}
                    onChange={(e) => setDeposit(a, Number(e.target.value))}
                    className="h-8 w-24 text-xs"
                  />
                </div>
                <Button size="sm" variant={a.usedPlanSession ? "secondary" : "outline"} onClick={() => togglePlan(a)}>
                  {a.usedPlanSession ? "Estornar sessão do plano" : "Consumir sessão do plano"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(a);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="panel p-12 text-center text-sm text-muted-foreground">
            Nenhum agendamento com esses filtros.
          </div>
        )}
      </div>

      <NewAppointmentDialog
        key={editing?.id ?? "novo"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
      />
    </>
  );
}