import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Política de Privacidade | Salon Fun",
  description: "Politica de privacidade do app Salon Fun, operado pela JC7 Desenvolvimentos.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      eyebrow="Política de Privacidade"
      title="Como o Salon Fun trata dados pessoais"
      summary="Esta política descreve como o app Salon Fun acessa, usa, compartilha e protege dados pessoais relacionados à autenticação, ao perfil do cliente e à operação do app do salão."
      lastUpdated="21 de abril de 2026"
      actions={[
        { href: "/termos", label: "Ver termos de uso", tone: "secondary" },
        { href: "/suporte", label: "Falar com o suporte", tone: "secondary" },
        { href: "/excluir-conta", label: "Pedir exclusão da conta" },
      ]}
      asideTitle="Contato e escopo"
      asideItems={[
        "Esta política cobre o app móvel Salon Fun e as páginas públicas de suporte relacionadas a ele.",
        "Salon Fun é um produto operado pela JC7 Desenvolvimentos.",
        "Responsável técnico e operacional: JC7 Desenvolvimentos.",
        "Contato principal para privacidade e suporte: tecnologijc@gmail.com.",
        "Os links desta política são públicos e destinados também ao cumprimento das exigências da Google Play.",
      ]}
      sections={[
        {
          title: "1. Dados que o app pode acessar ou receber",
          paragraphs: [
            "O app pode tratar dados enviados pela própria pessoa usuária, dados associados ao salão escolhido e dados técnicos necessários para a autenticação e o funcionamento do serviço.",
          ],
          bullets: [
            "Dados de autenticação e conta, como e-mail e identificadores de login usados no acesso.",
            "Dados de perfil, como nome, telefone, data de nascimento e foto de perfil quando a pessoa optar por enviar.",
            "Dados operacionais do relacionamento com o salão, como agendamentos, fidelidade, indicações, compras, preferências e histórico apresentado no app.",
            "Dados técnicos do aparelho e do app, como token de push, versão do aplicativo, plataforma, informações de sessão e identificadores usados por provedores de infraestrutura e anúncios.",
          ],
        },
        {
          title: "2. Como esses dados são usados",
          bullets: [
            "Autenticar a conta e vincular a pessoa usuária ao salão correto.",
            "Sincronizar perfil, agenda, benefícios, pedidos, notificações e conteúdo disponível dentro do app.",
            "Permitir login com provedores externos, como Google, quando essas opções estiverem habilitadas.",
            "Entregar notificações de lembretes, campanhas, atualizações do salão e avisos importantes do app.",
            "Exibir anúncios quando o build publicado estiver com monetização habilitada.",
            "Prevenir fraude, abuso, erro operacional e uso indevido da plataforma.",
          ],
        },
        {
          title: "3. Compartilhamento e operadores de dados",
          paragraphs: [
            "O Salon Fun não vende dados pessoais. O compartilhamento ocorre somente quando necessário para operar o app, autenticar a conta, entregar notificações, hospedar arquivos, exibir anúncios ou cumprir obrigações legais.",
          ],
          bullets: [
            "Google Firebase, para autenticação e mensageria push.",
            "Supabase, para banco de dados, autenticação complementar, storage e funções de backend.",
            "Google AdMob, quando anúncios estiverem ativos no build publicado.",
            "O salão ao qual a conta foi vinculada, para viabilizar atendimento, cadastro, agenda, benefícios e comunicação operacional.",
          ],
        },
        {
          title: "4. Retenção, segurança e base operacional",
          paragraphs: [
            "Os dados são mantidos pelo tempo necessário para a operação do app, para a prestação do serviço ao salão, para suporte, prevenção a abuso e cumprimento de obrigações legais ou regulatórias.",
            "O tráfego entre app e serviços compatíveis é feito por canais seguros, como HTTPS. O acesso a áreas autenticadas depende de conta válida e mecanismos de sessão.",
          ],
          bullets: [
            "Dados opcionais podem ser atualizados pela própria pessoa usuária dentro do app quando o recurso estiver disponível.",
            "Alguns registros operacionais podem ser mantidos ou anonimizados mesmo após um pedido de exclusão, quando isso for necessário para obrigações legais, segurança ou integridade do serviço.",
          ],
        },
        {
          title: "5. Direitos da pessoa usuária",
          paragraphs: [
            "Quem usa o app pode solicitar informações, correções e exclusão de conta ou dados associados ao app, observadas as limitações técnicas, operacionais e legais aplicáveis.",
            "Para pedidos de privacidade ou exclusão, use a página pública de exclusão ou o canal de suporte informado nesta política.",
          ],
        },
      ]}
    />
  );
}
