import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Termos de Uso | Salon Fun",
  description: "Termos de uso do app Salon Fun, operado pela JC7 Desenvolvimentos.",
};

export default function TermsPage() {
  return (
    <LegalDocumentPage
      eyebrow="Termos de Uso"
      title="Condições gerais de uso do app Salon Fun"
      summary="Estes termos regulam o uso do app móvel Salon Fun, destinado à experiência do cliente final do salão dentro do ecossistema da plataforma."
      lastUpdated="21 de abril de 2026"
      actions={[
        { href: "/privacidade", label: "Ver política de privacidade", tone: "secondary" },
        { href: "/suporte", label: "Abrir suporte", tone: "secondary" },
      ]}
      asideTitle="Resumo rápido"
      asideItems={[
        "App: Salon Fun.",
        "Marca pública do produto: Salon Fun.",
        "Operação técnica e empresarial: JC7 Desenvolvimentos.",
        "Uso destinado à pessoa cliente vinculada a um salão participante.",
        "Contato de suporte: tecnologijc@gmail.com.",
      ]}
      sections={[
        {
          title: "1. Sobre o serviço",
          paragraphs: [
            "O Salon Fun oferece um app para relacionamento entre salão e cliente, com recursos como agenda, feed, benefícios, loja, campanhas, perfil e notificações, conforme os módulos que cada salão publicar ou habilitar.",
          ],
        },
        {
          title: "2. Conta e acesso",
          bullets: [
            "A pessoa usuária é responsável pelas informações fornecidas no cadastro e pelo uso correto da conta.",
            "O acesso pode depender de confirmação de e-mail, login social válido ou vínculo com um código de salão.",
            "O uso de credenciais de terceiros sem autorização, fraude, automação abusiva ou qualquer tentativa de contornar segurança pode resultar em bloqueio do acesso.",
          ],
        },
        {
          title: "3. Conteúdo e operação do salão",
          paragraphs: [
            "Parte do conteúdo exibido no app é publicada, configurada ou mantida pelo próprio salão, como catálogo, promoções, agenda, imagens, campanhas, políticas de reserva e canais de contato.",
            "O app não garante disponibilidade contínua de ofertas, horários, profissionais, preços ou benefícios publicados por cada salão.",
          ],
        },
        {
          title: "4. Uso aceitável",
          bullets: [
            "Não é permitido usar o app para fraude, abuso, engenharia reversa, extração automatizada indevida de dados, distribuição de malware ou violação de direitos de terceiros.",
            "Não é permitido tentar acessar áreas, contas, tokens ou dados que não pertençam à própria pessoa usuária.",
            "O app pode limitar, suspender ou encerrar funcionalidades para preservar a segurança e a integridade da plataforma.",
          ],
        },
        {
          title: "5. Serviços de terceiros",
          paragraphs: [
            "O Salon Fun pode depender de provedores externos para autenticação, push, storage, anúncios e infraestrutura. O uso dessas integrações pode estar sujeito também aos termos e políticas dos respectivos provedores.",
          ],
        },
        {
          title: "6. Alterações, suporte e encerramento",
          paragraphs: [
            "Funcionalidades, módulos e fluxos podem ser ajustados ao longo do tempo para evolução do produto, segurança, compatibilidade e exigências de plataforma.",
            "Dúvidas operacionais, suporte técnico e pedidos relacionados à conta podem ser encaminhados pelo canal de suporte oficial indicado nas páginas públicas do app.",
          ],
        },
      ]}
    />
  );
}
