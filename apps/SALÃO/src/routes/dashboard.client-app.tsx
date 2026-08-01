import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, uid, useSalon } from "@/lib/salon-store";
import type { ClientAppConfig } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/client-app")({
  component: ClientApp,
  head: () => ({
    meta: [
      { title: "App do cliente · Maison Lumière" },
      { name: "description", content: "Personalize cores, textos, blocos e regras do aplicativo do seu salão." },
    ],
  }),
});

const radiusMap = { sharp: "0px", soft: "14px", round: "28px" } as const;
const fontMap = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

function ClientApp() {
  const { clientApp, services, professionals, update } = useSalon();
  const [cfg, setCfg] = useState<ClientAppConfig>(clientApp);

  const set = <K extends keyof ClientAppConfig>(key: K, value: ClientAppConfig[K]) =>
    setCfg((p) => ({ ...p, [key]: value }));

  const save = () => {
    update("clientApp", cfg);
    toast.success("App do cliente atualizado");
  };

  const dark = cfg.theme === "escuro";
  const surface = dark ? "#161311" : cfg.backgroundColor;
  const text = dark ? "#F5F1EC" : cfg.textColor;

  return (
    <>
      <PageHeader
        title="App do cliente"
        subtitle="Deixe o aplicativo com a cara do seu salão — cores, textos, blocos e regras"
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={() => { setCfg(clientApp); toast("Alterações descartadas"); }}>
              Descartar
            </Button>
            <Button className="rounded-full" onClick={save}>Publicar alterações</Button>
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <Tabs defaultValue="marca">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="marca">Marca</TabsTrigger>
            <TabsTrigger value="hero">Hero & Home</TabsTrigger>
            <TabsTrigger value="blocos">Blocos</TabsTrigger>
            <TabsTrigger value="modulos">Módulos</TabsTrigger>
            <TabsTrigger value="reserva">Reserva</TabsTrigger>
            <TabsTrigger value="suporte">Suporte</TabsTrigger>
          </TabsList>

          <TabsContent value="marca" className="space-y-5">
            <div className="panel grid gap-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome do app"><Input value={cfg.appName} onChange={(e) => set("appName", e.target.value)} /></Field>
                <Field label="Logo (texto)"><Input value={cfg.logoText} onChange={(e) => set("logoText", e.target.value)} /></Field>
              </div>
              <Field label="Tagline"><Input value={cfg.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <ColorField label="Primária" value={cfg.primaryColor} onChange={(v) => set("primaryColor", v)} />
                <ColorField label="Destaque" value={cfg.accentColor} onChange={(v) => set("accentColor", v)} />
                <ColorField label="Fundo" value={cfg.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
                <ColorField label="Texto" value={cfg.textColor} onChange={(v) => set("textColor", v)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Cantos">
                  <Select value={cfg.cornerStyle} onValueChange={(v) => set("cornerStyle", v as ClientAppConfig["cornerStyle"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sharp">Retos</SelectItem>
                      <SelectItem value="soft">Suaves</SelectItem>
                      <SelectItem value="round">Arredondados</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tipografia">
                  <Select value={cfg.fontStyle} onValueChange={(v) => set("fontStyle", v as ClientAppConfig["fontStyle"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serif">Serifada</SelectItem>
                      <SelectItem value="sans">Sem serifa</SelectItem>
                      <SelectItem value="mono">Monoespaçada</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tema">
                  <Select value={cfg.theme} onValueChange={(v) => set("theme", v as ClientAppConfig["theme"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claro">Claro</SelectItem>
                      <SelectItem value="escuro">Escuro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hero" className="space-y-5">
            <div className="panel grid gap-5 p-6">
              <Field label="Título do hero"><Input value={cfg.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} /></Field>
              <Field label="Subtítulo"><Textarea rows={2} value={cfg.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Texto do botão"><Input value={cfg.heroCta} onChange={(e) => set("heroCta", e.target.value)} /></Field>
                <Field label="Imagem do hero (URL)"><Input value={cfg.heroImage} onChange={(e) => set("heroImage", e.target.value)} /></Field>
              </div>
              <Field label="Mensagem de boas-vindas"><Textarea rows={2} value={cfg.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} /></Field>
            </div>
          </TabsContent>

          <TabsContent value="blocos" className="space-y-4">
            {cfg.highlightBlocks.map((b, i) => (
              <div key={b.id} className="panel grid gap-3 p-5 sm:grid-cols-[70px_1fr_1fr_auto]">
                <Input value={b.emoji} onChange={(e) => set("highlightBlocks", cfg.highlightBlocks.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)))} />
                <Input value={b.title} onChange={(e) => set("highlightBlocks", cfg.highlightBlocks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Input value={b.subtitle} onChange={(e) => set("highlightBlocks", cfg.highlightBlocks.map((x, j) => (j === i ? { ...x, subtitle: e.target.value } : x)))} />
                <Button variant="ghost" className="text-destructive" onClick={() => set("highlightBlocks", cfg.highlightBlocks.filter((_, j) => j !== i))}>
                  Remover
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => set("highlightBlocks", [...cfg.highlightBlocks, { id: uid("blk"), title: "Novo bloco", subtitle: "Descrição", emoji: "✨" }])}
            >
              Adicionar bloco da home
            </Button>
          </TabsContent>

          <TabsContent value="modulos" className="space-y-3">
            <div className="panel divide-y divide-border p-2">
              <Toggle label="Mostrar preços dos serviços" checked={cfg.showPrices} onChange={(v) => set("showPrices", v)} />
              <Toggle label="Mostrar equipe" checked={cfg.showTeam} onChange={(v) => set("showTeam", v)} />
              <Toggle label="Mostrar feed do salão" checked={cfg.showFeed} onChange={(v) => set("showFeed", v)} />
              <Toggle label="Mostrar fidelidade" checked={cfg.showLoyalty} onChange={(v) => set("showLoyalty", v)} />
              <Toggle label="Mostrar loja de produtos" checked={cfg.showStore} onChange={(v) => set("showStore", v)} />
            </div>
          </TabsContent>

          <TabsContent value="reserva" className="space-y-5">
            <div className="panel divide-y divide-border p-2">
              <Toggle label="Permitir agendamento online" checked={cfg.allowOnlineBooking} onChange={(v) => set("allowOnlineBooking", v)} />
              <Toggle label="Exigir sinal na reserva" checked={cfg.requireDeposit} onChange={(v) => set("requireDeposit", v)} />
            </div>
            <div className="panel grid gap-4 p-6 sm:grid-cols-3">
              <Field label="Sinal (%)"><Input type="number" value={cfg.depositPercent} onChange={(e) => set("depositPercent", Number(e.target.value))} /></Field>
              <Field label="Janela de cancelamento (h)"><Input type="number" value={cfg.cancelWindowHours} onChange={(e) => set("cancelWindowHours", Number(e.target.value))} /></Field>
              <Field label="Auto cancelar após (min)"><Input type="number" value={cfg.autoCancelMinutes} onChange={(e) => set("autoCancelMinutes", Number(e.target.value))} /></Field>
            </div>
          </TabsContent>

          <TabsContent value="suporte" className="space-y-5">
            <div className="panel grid gap-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefone de suporte"><Input value={cfg.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} /></Field>
                <Field label="Código de convite">
                  <div className="flex gap-2">
                    <Input value={cfg.inviteCode} readOnly />
                    <Button variant="outline" onClick={() => { set("inviteCode", uid("MAISON").toUpperCase()); toast.success("Novo código gerado"); }}>
                      Regenerar
                    </Button>
                  </div>
                </Field>
              </div>
              <Field label="Endereço"><Textarea rows={2} value={cfg.address} onChange={(e) => set("address", e.target.value)} /></Field>
            </div>
          </TabsContent>
        </Tabs>

        {/* Live preview */}
        <div className="xl:sticky xl:top-24 xl:self-start">
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Pré-visualização ao vivo</p>
          <div className="mx-auto w-[340px] overflow-hidden rounded-[36px] border-8 border-foreground/90 shadow-xl">
            <div
              className="h-[640px] overflow-y-auto p-4"
              style={{ background: surface, color: text, fontFamily: fontMap[cfg.fontStyle] }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-semibold" style={{ color: cfg.primaryColor }}>{cfg.logoText}</span>
                <span className="text-[10px] opacity-60">{cfg.tagline}</span>
              </div>

              <div
                className="mb-4 overflow-hidden p-5"
                style={{ background: cfg.primaryColor, borderRadius: radiusMap[cfg.cornerStyle], color: "#fff" }}
              >
                <p className="text-xl leading-tight">{cfg.heroTitle}</p>
                <p className="mt-1 text-xs opacity-85">{cfg.heroSubtitle}</p>
                {cfg.allowOnlineBooking && (
                  <span
                    className="mt-4 inline-block px-4 py-2 text-xs font-medium"
                    style={{ background: cfg.accentColor, borderRadius: radiusMap[cfg.cornerStyle], color: "#1b1613" }}
                  >
                    {cfg.heroCta}
                  </span>
                )}
              </div>

              <p className="mb-3 text-xs opacity-70">{cfg.welcomeMessage}</p>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {cfg.highlightBlocks.map((b) => (
                  <div key={b.id} className="p-3" style={{ background: dark ? "#221d1a" : "#00000008", borderRadius: radiusMap[cfg.cornerStyle] }}>
                    <span className="text-base">{b.emoji}</span>
                    <p className="text-xs font-medium">{b.title}</p>
                    <p className="text-[10px] opacity-60">{b.subtitle}</p>
                  </div>
                ))}
              </div>

              <p className="mb-2 text-[10px] uppercase tracking-widest opacity-60">Serviços</p>
              <div className="mb-4 space-y-2">
                {services.slice(0, 4).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 text-xs"
                    style={{ background: dark ? "#221d1a" : "#00000008", borderRadius: radiusMap[cfg.cornerStyle] }}>
                    <span>{s.name}</span>
                    {cfg.showPrices && <span style={{ color: cfg.primaryColor }}>{brl(s.price)}</span>}
                  </div>
                ))}
              </div>

              {cfg.showTeam && (
                <>
                  <p className="mb-2 text-[10px] uppercase tracking-widest opacity-60">Equipe</p>
                  <div className="mb-4 flex gap-2">
                    {professionals.slice(0, 4).map((p) => (
                      <div key={p.id} className="flex-1 p-2 text-center text-[10px]"
                        style={{ background: dark ? "#221d1a" : "#00000008", borderRadius: radiusMap[cfg.cornerStyle] }}>
                        {p.name.split(" ")[0]}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {cfg.showLoyalty && (
                <div className="mb-3 p-3 text-xs" style={{ background: cfg.accentColor, borderRadius: radiusMap[cfg.cornerStyle], color: "#1b1613" }}>
                  Fidelidade · 320 pontos acumulados
                </div>
              )}
              {cfg.showStore && (
                <div className="mb-3 p-3 text-xs" style={{ background: dark ? "#221d1a" : "#00000008", borderRadius: radiusMap[cfg.cornerStyle] }}>
                  Loja · produtos exclusivos do salão
                </div>
              )}
              {cfg.showFeed && (
                <div className="mb-3 p-3 text-xs" style={{ background: dark ? "#221d1a" : "#00000008", borderRadius: radiusMap[cfg.cornerStyle] }}>
                  Feed · novidades e transformações
                </div>
              )}

              <p className="mt-4 text-center text-[10px] opacity-50">
                {cfg.supportPhone} · código {cfg.inviteCode}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-10 cursor-pointer rounded-md border border-border bg-transparent" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}