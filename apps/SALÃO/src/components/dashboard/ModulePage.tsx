import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { brl, uid, useSalon } from "@/lib/salon-store";

export default function ModulePage({
  moduleKey,
  title,
  subtitle,
}: {
  moduleKey: string;
  title: string;
  subtitle: string;
}) {
  const salon = useSalon();
  const {
    transactions, professionals, appointments, clients, products, orders,
    posts, promotions, comandas, settings, update,
  } = salon;
  const [text, setText] = useState("");

  const revenue = transactions.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button className="rounded-full" onClick={() => toast.success(`${title}: ação registrada`)}>
            Ação principal
          </Button>
        }
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Receita acumulada" value={brl(revenue)} tone="primary" />
        <StatCard label="Clientes na base" value={String(clients.length)} />
        <StatCard label="Atendimentos" value={String(appointments.length)} tone="success" />
        <StatCard label="Meta mensal" value={brl(settings.monthlyGoal)} tone="warning" />
      </section>

      {moduleKey.includes("comissoes") && (
        <div className="space-y-3">
          {professionals.map((p) => (
            <div key={p.id} className="panel flex items-center justify-between p-4 text-sm">
              <span>{p.name} · {p.commission}%</span>
              <span className="font-medium">
                {brl(appointments.filter((a) => a.professionalId === p.id && a.status === "concluido").reduce((s, a) => s + a.price, 0) * (p.commission / 100))}
              </span>
            </div>
          ))}
        </div>
      )}

      {moduleKey.includes("pagamentos") && (
        <div className="space-y-2">
          {transactions.filter((t) => t.type === "entrada").map((t) => (
            <div key={t.id} className="panel flex items-center justify-between p-4 text-sm">
              <span>{t.description} · {t.method}</span>
              <span className="font-medium text-success">{brl(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {moduleKey.includes("comandas") && (
        <div className="space-y-3">
          {comandas.map((c) => (
            <div key={c.id} className="panel p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{c.clientName} · {c.status}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    update("comandas", comandas.map((x) => x.id === c.id ? { ...x, items: [...x.items, { id: uid("it"), name: "Item adicional", price: 60 }] } : x));
                    toast.success("Item adicionado");
                  }}>Add item</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    update("comandas", comandas.map((x) => x.id === c.id ? { ...x, payments: [...x.payments, { id: uid("pay"), method: "pix", amount: 60 }] } : x));
                    toast.success("Pagamento adicionado");
                  }}>Add pagamento</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    update("comandas", comandas.map((x) => x.id === c.id ? { ...x, status: "fechada" as const } : x));
                    toast.success("Comanda fechada");
                  }}>Fechar</Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {c.items.length} itens · total {brl(c.items.reduce((s, i) => s + i.price, 0))}
              </p>
            </div>
          ))}
          <Button variant="outline" className="rounded-full" onClick={() => {
            update("comandas", [...comandas, { id: uid("cmd"), clientName: text || "Cliente avulso", opened: new Date().toISOString().slice(11, 16), items: [], payments: [], status: "aberta" }]);
            toast.success("Comanda aberta");
          }}>Abrir comanda</Button>
        </div>
      )}

      {moduleKey.includes("inventory") && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Estoque</h2>
            {products.map((p) => (
              <div key={p.id} className="panel flex items-center justify-between p-4 text-sm">
                <span>{p.name} · {p.brand}</span>
                <div className="flex items-center gap-3">
                  <span className={p.stock <= p.minStock ? "text-destructive" : ""}>{p.stock} un</span>
                  <Button size="sm" variant="outline" onClick={() => {
                    update("products", products.map((x) => x.id === p.id ? { ...x, stock: x.stock + 1 } : x));
                    toast.success("Movimentação registrada");
                  }}>+1</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Pedidos</h2>
            {orders.map((o) => (
              <div key={o.id} className="panel flex items-center justify-between p-4 text-sm">
                <span>{o.clientName} · {o.productName}</span>
                <Button size="sm" variant="outline" onClick={() => {
                  const next = { novo: "separando", separando: "pronto", pronto: "entregue", entregue: "entregue" } as const;
                  update("orders", orders.map((x) => x.id === o.id ? { ...x, status: next[x.status] } : x));
                  toast.success("Status atualizado");
                }}>{o.status}</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {moduleKey.includes("feed") && (
        <div className="space-y-4">
          <div className="panel flex gap-2 p-4">
            <Input placeholder="Escreva um post do salão" value={text} onChange={(e) => setText(e.target.value)} />
            <Button onClick={() => {
              if (!text.trim()) { toast.error("Escreva algo."); return; }
              update("posts", [{ id: uid("post"), format: "standard", title: text.slice(0, 40), body: text, createdAt: new Date().toISOString().slice(0, 10), likes: 0, comments: [] }, ...posts]);
              setText("");
              toast.success("Post publicado");
            }}>Publicar</Button>
          </div>
          {posts.map((p) => (
            <div key={p.id} className="panel p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.format}</p>
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span>{p.likes} curtidas · {p.comments.length} comentários</span>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                  update("posts", posts.filter((x) => x.id !== p.id));
                  toast.success("Post excluído");
                }}>Excluir</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {moduleKey.includes("promotions") && (
        <div className="space-y-3">
          {promotions.map((p) => (
            <div key={p.id} className="panel flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{p.name} · {p.discount}%</p>
                <p className="text-xs text-muted-foreground">{p.channel} · {p.redemptions} resgates</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={p.active} onCheckedChange={(v) => update("promotions", promotions.map((x) => x.id === p.id ? { ...x, active: v } : x))} />
                <Button size="sm" variant="outline" onClick={() => toast.success(`Campanha "${p.name}" enviada`)}>Enviar</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                  update("promotions", promotions.filter((x) => x.id !== p.id));
                  toast.success("Campanha excluída");
                }}>Excluir</Button>
              </div>
            </div>
          ))}
          <Button variant="outline" className="rounded-full" onClick={() => {
            update("promotions", [...promotions, { id: uid("promo"), name: "Nova oferta", discount: 15, channel: "WhatsApp", active: true, redemptions: 0 }]);
            toast.success("Campanha criada");
          }}>Criar campanha</Button>
        </div>
      )}

      {moduleKey.includes("birthdays") && (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.id} className="panel flex items-center justify-between p-4 text-sm">
              <span>{c.name} · {c.birthday}</span>
              <Button size="sm" variant="outline" onClick={() => toast.success(`Parabéns enviado para ${c.name}`)}>Enviar mensagem</Button>
            </div>
          ))}
        </div>
      )}

      {(moduleKey.includes("settings") || moduleKey.includes("billing") || moduleKey.includes("subscriptions") ||
        moduleKey.includes("notifications") || moduleKey.includes("ai") || moduleKey.includes("benefits") ||
        moduleKey.includes("operations")) && (
        <div className="panel space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Módulo operacional conectado aos dados do salão. Use as ações abaixo para simular o fluxo completo.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Salvar configuração", "Exportar dados", "Regenerar código", "Atualizar plano"].map((a) => (
              <Button key={a} variant="outline" className="rounded-full" onClick={() => toast.success(`${a} concluído`)}>
                {a}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}