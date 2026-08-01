import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, formatDateBR, uid, useSalon } from "@/lib/salon-store";

export const Route = createFileRoute("/dashboard/finance/despesas")({
  component: Despesas,
});

function Despesas() {
  const { expenses, transactions, update } = useSalon();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", dueDate: new Date().toISOString().slice(0, 10), amount: 0, recurring: false });

  const aberto = expenses.filter((e) => !e.paid);
  const total = aberto.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader
        title="Despesas"
        subtitle="Contas a pagar, despesas manuais e regras recorrentes"
        actions={<Button className="rounded-full" onClick={() => setOpen(true)}>Nova conta a pagar</Button>}
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-3">
        <StatCard label="Em aberto" value={brl(total)} tone="warning" />
        <StatCard label="Contas pendentes" value={String(aberto.length)} />
        <StatCard label="Recorrentes ativas" value={String(expenses.filter((e) => e.recurring).length)} tone="primary" />
      </section>

      <div className="space-y-3">
        {expenses.map((e) => (
          <div key={e.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-medium">{e.description}</p>
              <p className="text-xs text-muted-foreground">
                Vence {formatDateBR(e.dueDate)} · {e.recurring ? "Recorrente" : "Avulsa"} · {e.paid ? "Pago" : "Em aberto"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{brl(e.amount)}</span>
              <div className="flex items-center gap-1.5 text-xs">
                <Switch checked={e.recurring} onCheckedChange={(v) => update("expenses", expenses.map((x) => (x.id === e.id ? { ...x, recurring: v } : x)))} />
                Recorrente
              </div>
              {e.recurring && (
                <Button size="sm" variant="ghost" onClick={() => {
                  update("expenses", [...expenses, { ...e, id: uid("exp"), paid: false }]);
                  toast.success("Lançamento recorrente registrado");
                }}>Lançar</Button>
              )}
              <Button size="sm" variant={e.paid ? "ghost" : "outline"} disabled={e.paid} onClick={() => {
                update("expenses", expenses.map((x) => (x.id === e.id ? { ...x, paid: true } : x)));
                update("transactions", [{ id: uid("tx"), date: new Date().toISOString().slice(0, 10), description: e.description, category: "Despesa", method: "pix" as const, type: "saida" as const, amount: e.amount }, ...transactions]);
                toast.success("Baixa registrada");
              }}>{e.paid ? "Pago" : "Dar baixa"}</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Nova conta a pagar</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Valor</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div className="grid gap-2"><Label>Vencimento</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: v })} />
              Criar como regra recorrente
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!form.description.trim()) { toast.error("Informe a descrição."); return; }
              update("expenses", [...expenses, { ...form, id: uid("exp"), paid: false }]);
              toast.success("Conta criada");
              setOpen(false);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}