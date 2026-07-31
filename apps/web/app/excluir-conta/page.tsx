import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Excluir Conta | Salon Fun",
  description: "Solicitação de exclusão de conta do app Salon Fun.",
};

type DeleteAccountPageProps = {
  searchParams?: Promise<{
    confirmation_code?: string;
    source?: string;
  }>;
};

export default async function DeleteAccountPage({
  searchParams,
}: DeleteAccountPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const confirmationCode =
    resolvedSearchParams?.confirmation_code?.trim() || null;
  const deletionSource = resolvedSearchParams?.source?.trim() || null;

  return (
    <LegalDocumentPage
      eyebrow="Exclusão de Conta"
      title="Como pedir a exclusão da sua conta no Salon Fun"
      summary={
        confirmationCode
          ? `Solicitação registrada. Guarde o código ${confirmationCode} para acompanhamento.`
          : "Esta página explica como solicitar a exclusão da conta e dos dados ligados ao app Salon Fun. Ela pode ser usada também como URL pública de exclusão vinculada à publicação do app."
      }
      lastUpdated="21 de abril de 2026"
      actions={[
        {
          href: "mailto:tecnologijc@gmail.com?subject=Exclusao%20de%20conta%20Salon%20Fun",
          label: "Solicitar por e-mail",
        },
        { href: "/privacidade", label: "Ler política de privacidade", tone: "secondary" },
      ]}
      asideTitle="Dados para enviar no pedido"
      asideItems={
        confirmationCode
          ? [
              `Código de confirmação: ${confirmationCode}.`,
              "Nome usado no app.",
              "E-mail da conta vinculada.",
              "Salão relacionado ou código de vínculo, se souber.",
            ]
          : [
              "Nome usado no app.",
              "E-mail da conta vinculada.",
              "Salão relacionado ou código de vínculo, se souber.",
              "Pedido claro de exclusão da conta do app Salon Fun.",
            ]
      }
      sections={[
        ...(confirmationCode
          ? [
              {
                title: "0. Confirmação do pedido",
                paragraphs: [
                  `Recebemos uma solicitação vinculada ao código ${confirmationCode}.`,
                  "Guarde esse código para informar no suporte caso precise acompanhar o pedido.",
                ],
              },
            ]
          : []),
        {
          title: "1. Como solicitar",
          paragraphs: [
            "Envie um pedido para tecnologijc@gmail.com com o assunto “Exclusão de conta Salon Fun”.",
            "Para segurança, o atendimento pode pedir confirmação de identidade antes de concluir a exclusão.",
          ],
        },
        {
          title: "2. O que normalmente é tratado no pedido",
          bullets: [
            "Encerramento do acesso da conta ao app.",
            "Desativação de tokens de notificação associados ao aparelho.",
            "Tratamento dos dados do perfil do cliente vinculados ao app, observadas as limitações legais e operacionais aplicáveis.",
          ],
        },
        {
          title: "3. O que pode permanecer",
          paragraphs: [
            "Alguns registros podem ser mantidos, anonimizados ou preservados quando forem necessários para prevenção a fraude, segurança, auditoria, obrigações legais ou histórico operacional do salão.",
          ],
        },
        {
          title: "4. Importante",
          paragraphs: [
            "Se o seu relacionamento com o salão depender de registros operacionais mantidos pelo próprio estabelecimento, parte das informações pode continuar sujeita às políticas e obrigações desse salão.",
          ],
        },
      ]}
    />
  );
}
