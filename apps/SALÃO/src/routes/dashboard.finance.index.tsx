import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, formatDateBR, uid, useSalon } from "@/lib/salon-store";
import type { Transaction } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/finance/")({
  component: Finance,
});

function Finance() {
  const { transactions, professionals, cashOpen, patch, update } = useSalon();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Transaction>({
    id: "", date: new Date().toISOString().slice(0, 10), description: "", category: "Serviço",
    method: "pix", type: "entrada", amount: 0,
  });

  const entradas = transactions.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const saidas = transactions.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
  const count = transactions.filter((t) => t.type === "entrada").length;

  return (
    <>
      <PageHeader
        title="Caixa"
        subtitle="Receita, transações e leitura financeira"
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={() => { patch({ cashOpen: !cashOpen }); toast.success(cashOpen ? "Caixa fechado" : "Caixa aberto"); }}>
              {cashOpen ? "Fechar caixa" : "Abrir caixa"}
            </Button>
            <Button className="rounded-full" onClick={() => setOpen(true)}>Nova transação</Button>
          </>
        }
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entradas" value={brl(entradas)} tone="success" />
        <StatCard label="Saídas" value={brl(saidas)} tone="warning" />
        <StatCard label="Saldo" value={brl(entradas - saidas)} tone="primary" />
        <StatCard label="Ticket médio" value={brl(entradas / (count || 1))} />
      </section>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Movimentação</h2>
        <span className={`rounded-full px-3 py-1 text-xs ${cashOpen ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
          Caixa {cashOpen ? "aberto" : "fechado"}
        </span>
      </div>
      <div className="space-y-2">
        {transactions.map((t) => (
          <div key={t.id} className="panel flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{t.description}</p>
              <p className="text-xs text-muted-foreground">{formatDateBR(t.date)} · {t.category} · {t.method}</p>
            </div>
            <span className={t.type === "entrada" ? "font-medium text-success" : "font-medium text-destructive"}>
              {t.type === "entrada" ? "+" : "−"} {brl(t.amount)}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-10 text-lg font-medium">Repasses da equipe</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {professionals.map((p) => (
          <div key={p.id} className="panel flex items-center justify-between p-4 text-sm">
            <span>{p.name} · comissão {p.commission}%</span>
            <Button size="sm" variant="outline" onClick={() => {
              update("transactions", [
                { id: uid("tx"), date: new Date().toISOString().slice(0, 10), description: `Repasse ${p.name}`, category: "Comissão", method: "pix" as const, type: "saida" as const, amount: 450 },
                ...transactions,
              ]);
              toast.success(`Repasse criado para ${p.name}`);
            }}>Criar repasse</Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Nova transação</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Valor</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div className="grid gap-2"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Transaction["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Método</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as Transaction["method"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!form.description.trim()) { toast.error("Informe a descrição."); return; }
              update("transactions", [{ ...form, id: uid("tx") }, ...transactions]);
              toast.success("Transação registrada");
              setOpen(false);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}