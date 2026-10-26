import type { Metadata } from "next";
import { getEnv } from "@/server/env";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  const env = getEnv();
  return (
    <LegalPage appName={env.APP_NAME} title="Termos de Uso" version={env.TERMS_VERSION}>
      <h2>1. O serviço</h2>
      <p>O {env.APP_NAME} permite enviar vídeos de partidas, marcar intervalos de tempo e receber os trechos cortados para download. O processamento consome créditos conforme as regras exibidas antes de cada confirmação.</p>
      <h2>2. Conteúdo enviado</h2>
      <ul>
        <li>Você só pode enviar vídeos que sejam seus ou que tenha autorização para usar, incluindo a autorização das pessoas filmadas — e, no caso de crianças e adolescentes, de seus responsáveis legais.</li>
        <li>É proibido enviar conteúdo obtido em violação de direitos autorais, termos de plataformas de terceiros ou da legislação.</li>
        <li>Você continua titular do seu conteúdo. Nós o processamos apenas para prestar o serviço.</li>
      </ul>
      <h2>3. Créditos</h2>
      <p>Créditos são debitados (reservados) ao iniciar um processamento e devolvidos automaticamente se ele falhar. Créditos de teste não têm valor comercial. Regras de compra, validade e reembolso de créditos pagos serão publicadas antes do início da cobrança.</p>
      <h2>4. Retenção</h2>
      <p>Vídeos enviados e cortes gerados são excluídos automaticamente após o prazo de retenção informado na sua conta. Faça o download do que quiser guardar.</p>
      <h2>5. Conta</h2>
      <p>Você é responsável pela segurança da sua senha. Pode excluir sua conta a qualquer momento nas configurações, o que remove seus arquivos e dados.</p>
    </LegalPage>
  );
}
