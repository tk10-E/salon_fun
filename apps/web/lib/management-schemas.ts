import { z } from "zod";

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function stringField(min: number, max: number, label: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z
      .string()
      .min(min, `${label} precisa ter pelo menos ${min} caracteres.`)
      .max(max, `${label} pode ter no máximo ${max} caracteres.`),
  );
}

function optionalStringField(max: number, label: string) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(max, `${label} pode ter no máximo ${max} caracteres.`)
      .optional(),
  );
}

function positiveNumberField(label: string) {
  return z.preprocess(
    (value) => Number(value),
    z
      .number()
      .finite(`${label} inválido.`)
      .positive(`${label} precisa ser maior que zero.`),
  );
}

function percentageField(label: string) {
  return z.preprocess(
    (value) => Number(value),
    z
      .number()
      .finite(`${label} inválido.`)
      .min(0, `${label} não pode ser negativo.`)
      .max(100, `${label} não pode passar de 100%.`),
  );
}

const uuidField = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().uuid(`${label} inválido.`),
  );

const optionalEmailField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .email("Informe um e-mail válido.")
    .max(180, "O e-mail pode ter no máximo 180 caracteres.")
    .optional(),
);

const optionalDateField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
    .optional(),
);

export const managementCategorySchema = z.object({
  name: stringField(2, 80, "Nome da categoria"),
  description: optionalStringField(280, "Descrição"),
  isActive: z.boolean().default(true),
});

export const managementCategoryUpdateSchema = managementCategorySchema.extend({
  categoryId: uuidField("Categoria"),
});

export const managementServiceSchema = z.object({
  name: stringField(2, 120, "Nome do serviço"),
  serviceCategoryId: uuidField("Categoria"),
  duration: z.preprocess(
    (value) => Number(value),
    z
      .number()
      .int("A duração precisa estar em minutos inteiros.")
      .min(5, "A duração precisa ser de pelo menos 5 minutos.")
      .max(600, "A duração máxima é de 600 minutos."),
  ),
  price: positiveNumberField("Preço"),
  description: optionalStringField(280, "Descrição"),
  isActive: z.boolean().default(true),
});

export const managementServiceUpdateSchema = managementServiceSchema.extend({
  serviceId: uuidField("Serviço"),
});

export const managementClientSchema = z.object({
  name: stringField(2, 120, "Nome do cliente"),
  phone: optionalStringField(30, "Telefone"),
  whatsappPhone: optionalStringField(30, "WhatsApp"),
  email: optionalEmailField,
  birthDate: optionalDateField,
  notes: optionalStringField(2000, "Observações"),
});

export const managementClientUpdateSchema = managementClientSchema.extend({
  clientId: uuidField("Cliente"),
});

export const managementProfessionalSchema = z.object({
  name: stringField(2, 120, "Nome do profissional"),
  specialty: optionalStringField(120, "Especialidade"),
  phone: optionalStringField(30, "Telefone"),
  commissionRatePercent: percentageField("Comissão"),
  isActive: z.boolean().default(true),
});

export const managementProfessionalUpdateSchema = managementProfessionalSchema.extend({
  professionalId: uuidField("Profissional"),
});

export const managementAppointmentSchema = z.object({
  clientId: uuidField("Cliente"),
  professionalId: uuidField("Profissional"),
  serviceId: uuidField("Serviço"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida."),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Informe um horário válido."),
  notes: optionalStringField(1000, "Observações"),
});

export const managementAppointmentUpdateSchema = managementAppointmentSchema.extend({
  appointmentId: uuidField("Agendamento"),
});

export const managementAppointmentStatusSchema = z.object({
  appointmentId: uuidField("Agendamento"),
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
  cancellationReason: optionalStringField(240, "Motivo do cancelamento"),
});

export const managementPaymentSchema = z.object({
  appointmentId: uuidField("Atendimento"),
  amount: positiveNumberField("Valor"),
  paymentMethod: z.enum(["pix", "cash", "debit_card", "credit_card"]),
  paidAtDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida."),
  paidAtTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Informe um horário válido."),
  notes: optionalStringField(500, "Observação"),
});

export const managementDeleteSchema = z.object({
  id: uuidField("Registro"),
});
