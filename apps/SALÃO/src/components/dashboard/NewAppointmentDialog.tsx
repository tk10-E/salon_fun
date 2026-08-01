import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uid, useSalon } from "@/lib/salon-store";
import { today } from "@/lib/salon-seed";
import type { Appointment } from "@/lib/salon-types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Appointment | null;
}

export function NewAppointmentDialog({ open, onOpenChange, editing }: Props) {
  const { clients, professionals, services, appointments, update } = useSalon();
  const [clientId, setClientId] = useState(editing?.clientId ?? clients[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState(editing?.professionalId ?? professionals[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(editing?.serviceId ?? services[0]?.id ?? "");
  const [date, setDate] = useState(editing?.date ?? today());
  const [time, setTime] = useState(editing?.time ?? "10:00");
  const [deposit, setDeposit] = useState(String(editing?.deposit ?? 0));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const submit = () => {
    const service = services.find((s) => s.id === serviceId);
    if (!clientId || !service) {
      toast.error("Selecione cliente e serviço.");
      return;
    }
    const record: Appointment = {
      id: editing?.id ?? uid("apt"),
      clientId,
      professionalId,
      serviceId,
      date,
      time,
      status: editing?.status ?? "pendente",
      price: service.price,
      deposit: Number(deposit) || 0,
      usedPlanSession: editing?.usedPlanSession ?? false,
      notes,
    };
    update(
      "appointments",
      editing
        ? appointments.map((a) => (a.id === editing.id ? record : a))
        : [...appointments, record],
    );
    toast.success(editing ? "Agendamento atualizado" : "Agendamento criado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Editar agendamento" : "Novo agendamento"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.duration}min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Sinal (R$)</Label>
              <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>{editing ? "Salvar" : "Criar agendamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}