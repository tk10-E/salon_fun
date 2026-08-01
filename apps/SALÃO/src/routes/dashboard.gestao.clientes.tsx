import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, uid, useSalon } from "@/lib/salon-store";
import type { Client } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/gestao/clientes")({
  component: Clientes,
});

const empty: Client = {
  id: "",
  name: "",
  phone: "",
  email: "",
  birthday: "",
  since: new Date().toISOString().slice(0, 10),
  visits: 0,
  totalSpent: 0,
  lastVisit: "-",
  tags: [],
};

function Clientes() {
  const { clients, update } = useSalon();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Client>(empty);

  const list = useMemo(
    () =>
      clients.filter((c) => {
        const match = (c.name + c.phone + c.email).toLowerCase().includes(query.toLowerCase());
        if (!match) return false;
        if (filter === "vip") return c.tags.includes("VIP");
        if (filter === "risco") return c.tags.includes("Em risco");
        if (filter === "plano") return !!c.plan;
        return true;
      }),
    [clients, query, filter],
  );

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (form.id) {
      update("clients", clients.map((c) => (c.id === form.id ? form : c)));
      toast.success("Cliente atualizado");
    } else {
      update("clients", [...clients, { ...form, id: uid("cli") }]);
      toast.success("Cliente cadastrado");
    }
    setOpen(false);
  };

  const withPlan = clients.filter((c) => c.plan);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="CRM e base de clientes do salão"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setForm(empty);
              setOpen(true);
            }}
          >
            Cadastrar cliente
          </Button>
        }
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Base total" value={String(clients.length)} />
        <StatCard label="Com plano ativo" value={String(withPlan.length)} tone="primary" />
        <StatCard label="Em risco" value={String(clients.filter((c) => c.tags.includes("Em risco")).length)} tone="warning" />
        <StatCard
          label="LTV médio"
          value={brl(clients.reduce((s, c) => s + c.totalSpent, 0) / (clients.length || 1))}
        />
      </section>

      <div className="panel mb-6 flex flex-wrap gap-3 p-4">
        <Input
          placeholder="Buscar por nome, telefone ou e-mail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="risco">Em risco</SelectItem>
            <SelectItem value="plano">Com plano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="panel flex flex-wrap items-center gap-4 p-4">
            <span className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-semibold">
              {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.phone} · {c.visits} atendimentos · {brl(c.totalSpent)}
                {c.plan ? ` · ${c.plan} (${c.planSessions} sessões)` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {c.tags.map((t) => (
                <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.success(`Lembrança enviada para ${c.name}`)}>
                Nudge
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  update(
                    "clients",
                    clients.map((x) =>
                      x.id === c.id
                        ? { ...x, plan: "Plano Beleza Mensal", planSessions: (x.planSessions ?? 0) + 4 }
                        : x,
                    ),
                  );
                  toast.success("Pacote atribuído (+4 sessões)");
                }}
              >
                Atribuir plano
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setForm(c);
                  setOpen(true);
                }}
              >
                Editar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar cliente" : "Cadastrar cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Aniversário</Label>
                <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}