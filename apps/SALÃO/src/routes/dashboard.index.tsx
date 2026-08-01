import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, uid, useSalon } from "@/lib/salon-store";
import type { Service } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/")({
  component: Servicos,
});

function Servicos() {
  const { services, categories, update } = useSalon();
  const [filter, setFilter] = useState("todas");
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catId, setCatId] = useState("");
  const [form, setForm] = useState<Service>({
    id: "",
    name: "",
    categoryId: categories[0]?.id ?? "",
    duration: 60,
    price: 100,
    description: "",
    active: true,
  });

  const visible = filter === "todas" ? services : services.filter((s) => s.categoryId === filter);

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do serviço.");
      return;
    }
    if (form.id) {
      update("services", services.map((s) => (s.id === form.id ? form : s)));
      toast.success("Serviço atualizado");
    } else {
      update("services", [...services, { ...form, id: uid("srv") }]);
      toast.success("Serviço criado");
    }
    setOpen(false);
  };

  const saveCategory = () => {
    if (!catName.trim()) return;
    if (catId) {
      update("categories", categories.map((c) => (c.id === catId ? { ...c, name: catName } : c)));
      toast.success("Categoria atualizada");
    } else {
      update("categories", [...categories, { id: uid("cat"), name: catName, color: "#C87D61" }]);
      toast.success("Categoria criada");
    }
    setCatOpen(false);
    setCatName("");
    setCatId("");
  };

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo do salão organizado por categoria"
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={() => { setCatId(""); setCatName(""); setCatOpen(true); }}>
              Nova categoria
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                setForm({ id: "", name: "", categoryId: categories[0]?.id ?? "", duration: 60, price: 100, description: "", active: true });
                setOpen(true);
              }}
            >
              Novo serviço
            </Button>
          </>
        }
      />

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("todas")}
          className={`rounded-full border px-4 py-2 text-xs font-medium ${filter === "todas" ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            onDoubleClick={() => { setCatId(c.id); setCatName(c.name); setCatOpen(true); }}
            className={`rounded-full border px-4 py-2 text-xs font-medium ${filter === c.id ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((s) => (
          <div key={s.id} className="panel flex flex-col p-5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-medium">{s.name}</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                {categories.find((c) => c.id === s.categoryId)?.name}
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">{s.description}</p>
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="font-display text-2xl">{brl(s.price)}</span>
              <span className="text-muted-foreground">{s.duration} min</span>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-2 text-xs">
                <Switch
                  checked={s.active}
                  onCheckedChange={(v) => update("services", services.map((x) => (x.id === s.id ? { ...x, active: v } : x)))}
                />
                {s.active ? "Ativo" : "Inativo"}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setForm(s); setOpen(true); }}>Editar</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    update("services", services.filter((x) => x.id !== s.id));
                    toast.success("Serviço excluído");
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{form.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Duração (min)</Label>
                <Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Preço (R$)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{catId ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nome da categoria" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button onClick={saveCategory}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}