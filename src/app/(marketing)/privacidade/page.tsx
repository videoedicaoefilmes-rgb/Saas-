import type { Metadata } from "next";
import { getEnv } from "@/server/env";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  const env = getEnv();
  return (
    <LegalPage appName={env.APP_NAME} title="Política de Privacidade" version={env.TERMS_VERSION}>
      <h2>Dados que tratamos</h2>
      <ul>
        <li>Cadastro: nome, e-mail e senha (guardada apenas como hash).</li>
        <li>Conteúdo: vídeos enviados, marcações de lances e os cortes gerados. Os vídeos podem conter imagens de crianças e adolescentes.</li>
        <li>Uso: registros técnicos de processamento, consumo de créditos e registros de segurança.</li>
      </ul>
      <h2>Para que usamos</h2>
      <p>Exclusivamente para prestar o serviço (armazenar, cortar e disponibilizar os vídeos), cobrar o consumo, prevenir abuso e cumprir obrigações legais. Não usamos os vídeos para treinar modelos nem os compartilhamos com terceiros para fins comerciais.</p>
      <h2>Segurança</h2>
      <ul>
        <li>Armazenamento privado; arquivos acessíveis apenas pela conta dona, por links temporários.</li>
        <li>Nenhum vídeo é público ou listado.</li>
      </ul>
      <h2>Retenção e exclusão</h2>
      <p>Vídeos enviados são mantidos por {env.RETENTION_SOURCE_DAYS} dias e cortes por {env.RETENTION_EXPORT_DAYS} dias. Você pode excluir projetos ou a conta inteira a qualquer momento.</p>
      <h2>Seus direitos (LGPD)</h2>
      <p>Você pode solicitar acesso, correção, portabilidade e exclusão dos seus dados. O canal de contato do encarregado (DPO) será informado antes do lançamento comercial.</p>
    </LegalPage>
  );
}
