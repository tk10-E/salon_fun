import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, formatDateBR, uid, useSalon } from "@/lib/salon-store";
import { today } from "@/lib/salon-seed";
import type { Professional } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/gestao/profissionais")({
  component: Equipe,
});

const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function Equipe() {
  const { professionals, services, blocks, appointments, update } = useSalon();
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockPro, setBlockPro] = useState(professionals[0]?.id ?? "");
  const [blockDate, setBlockDate] = useState(today());
  const [blockFrom, setBlockFrom] = useState("12:00");
  const [blockTo, setBlockTo] = useState("13:00");
  const [blockReason, setBlockReason] = useState("");
  const [form, setForm] = useState<Professional>({
    id: "", name: "", role: "", phone: "", commission: 40, active: true,
    serviceIds: [], workdays: ["Seg", "Ter", "Qua", "Qui", "Sex"], startTime: "09:00", endTime: "19:00",
  });

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    if (form.id) {
      update("professionals", professionals.map((p) => (p.id === form.id ? form : p)));
      toast.success("Profissional atualizado");
    } else {
      update("professionals", [...professionals, { ...form, id: uid("pro") }]);
      toast.success("Profissional cadastrado");
    }
    setOpen(false);
  };

  const revenueOf = (id: string) =>
    appointments.filter((a) => a.professionalId === id && a.status === "concluido").reduce((s, a) => s + a.price, 0);

  return (
    <>
      <PageHeader
        title="Equipe"
        subtitle="Profissionais, horários, comissões e bloqueios"
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={() => setBlockOpen(true)}>Novo bloqueio</Button>
            <Button
              className="rounded-full"
              onClick={() => {
                setForm({ id: "", name: "", role: "", phone: "", commission: 40, active: true, serviceIds: [], workdays: ["Seg", "Ter", "Qua", "Qui", "Sex"], startTime: "09:00", endTime: "19:00" });
                setOpen(true);
              }}
            >
              Cadastrar profissional
            </Button>
          </>
        }
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-3">
        <StatCard label="Profissionais ativos" value={String(professionals.filter((p) => p.active).length)} />
        <StatCard label="Comissão média" value={`${Math.round(professionals.reduce((s, p) => s + p.commission, 0) / (professionals.length || 1))}%`} tone="primary" />
        <StatCard label="Bloqueios ativos" value={String(blocks.length)} tone="warning" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {professionals.map((p) => (
          <div key={p.id} className="panel p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-medium">{p.name}</h3>
                <p className="text-xs text-muted-foreground">{p.role} · {p.phone}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch
                  checked={p.active}
                  onCheckedChange={(v) => update("professionals", professionals.map((x) => (x.id === p.id ? { ...x, active: v } : x)))}
                />
                {p.active ? "Ativo" : "Inativo"}
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
              <div><p className="text-muted-foreground">Comissão</p><p className="font-medium">{p.commission}%</p></div>
              <div><p className="text-muted-foreground">Jornada</p><p className="font-medium">{p.startTime}–{p.endTime}</p></div>
              <div><p className="text-muted-foreground">Faturou</p><p className="font-medium">{brl(revenueOf(p.id))}</p></div>
            </div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Dias</p>
            <p className="mb-3 text-xs">{p.workdays.join(" · ")}</p>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Serviços</p>
            <p className="mb-4 text-xs">
              {p.serviceIds.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "Nenhum"}
            </p>
            <div className="flex gap-2 border-t border-border pt-4">
              <Button size="sm" variant="outline" onClick={() => { setForm(p); setOpen(true); }}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => {
                update("professionals", professionals.map((x) => (x.id === p.id ? { ...x, active: false, role: `${x.role} (desligado)` } : x)));
                toast.success("Profissional desligado");
              }}>Desligar</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                update("professionals", professionals.filter((x) => x.id !== p.id));
                toast.success("Profissional excluído");
              }}>Excluir</Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-10 text-lg font-medium">Bloqueios de agenda</h2>
      <div className="space-y-3">
        {blocks.map((b) => (
          <div key={b.id} className="panel flex items-center justify-between p-4 text-sm">
            <span>
              {professionals.find((p) => p.id === b.professionalId)?.name} · {formatDateBR(b.date)} · {b.from}–{b.to} — {b.reason}
            </span>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
              update("blocks", blocks.filter((x) => x.id !== b.id));
              toast.success("Bloqueio removido");
            }}>Remover</Button>
          </div>
        ))}
        {blocks.length === 0 && <div className="panel p-8 text-center text-sm text-muted-foreground">Nenhum bloqueio ativo.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{form.id ? "Editar profissional" : "Cadastrar profissional"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Função</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Início</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Fim</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Comissão (%)</Label>
              <Input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label>Dias de trabalho</Label>
              <div className="flex flex-wrap gap-3">
                {days.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={form.workdays.includes(d)}
                      onCheckedChange={(v) =>
                        setForm({ ...form, workdays: v ? [...form.workdays, d] : form.workdays.filter((x) => x !== d) })
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Serviços atribuídos</Label>
              <div className="grid grid-cols-2 gap-2">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={form.serviceIds.includes(s.id)}
                      onCheckedChange={(v) =>
                        setForm({ ...form, serviceIds: v ? [...form.serviceIds, s.id] : form.serviceIds.filter((x) => x !== s.id) })
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-2xl">Novo bloqueio</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Label>Profissional</Label>
            <select className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" value={blockPro} onChange={(e) => setBlockPro(e.target.value)}>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
              <Input type="time" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} />
              <Input type="time" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} />
            </div>
            <Input placeholder="Motivo" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              update("blocks", [...blocks, { id: uid("blk"), professionalId: blockPro, date: blockDate, from: blockFrom, to: blockTo, reason: blockReason || "Bloqueio" }]);
              toast.success("Bloqueio criado");
              setBlockOpen(false);
            }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}