import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Suporte | Salon Fun",
  description: "Canais de suporte do app Salon Fun, operado pela JC7 Desenvolvimentos.",
};

export default function SupportPage() {
  return (
    <LegalDocumentPage
      eyebrow="Suporte"
      title="Canais oficiais de suporte do Salon Fun"
      summary="Use esta página para falar com a equipe responsável pelo app Salon Fun sobre acesso, publicação, privacidade, notificações, cadastro e outros pontos técnicos do aplicativo."
      lastUpdated="21 de abril de 2026"
      actions={[
        { href: "mailto:tecnologijc@gmail.com?subject=Suporte%20Salon%20Fun", label: "Enviar e-mail" },
        { href: "/privacidade", label: "Privacidade", tone: "secondary" },
        { href: "/excluir-conta", label: "Exclusão da conta", tone: "secondary" },
      ]}
      asideTitle="Antes de abrir um chamado"
      asideItems={[
        "Informe o e-mail da conta usada no app.",
        "Se possível, informe o salão ou código de vínculo.",
        "A marca pública do produto é Salon Fun e a operação técnica é da JC7 Desenvolvimentos.",
        "Descreva o aparelho, a versão do app e o erro visto na tela.",
        "Para privacidade ou exclusão, use também a página específica de exclusão.",
      ]}
      sections={[
        {
          title: "1. Canal principal",
          paragraphs: [
            "Contato principal do app: tecnologijc@gmail.com.",
            "Esse canal pode ser usado para dúvidas de autenticação, notificações, erros operacionais, dúvidas sobre links públicos e temas de publicação do app.",
          ],
        },
        {
          title: "2. Casos atendidos por este suporte",
          bullets: [
            "Problemas para entrar no app por e-mail ou Google.",
            "Falhas no recebimento de notificações e push.",
            "Dúvidas sobre política de privacidade, termos e exclusão da conta do app.",
            "Erros de cadastro, sincronização ou comportamento inesperado do aplicativo.",
          ],
        },
        {
          title: "3. O que acelera o atendimento",
          bullets: [
            "Enviar prints ou uma descrição objetiva do fluxo até o erro.",
            "Informar se o problema ocorreu em Android, iPhone ou web.",
            "Confirmar se o problema acontece sempre ou só em um caso específico.",
          ],
        },
      ]}
    />
  );
}
