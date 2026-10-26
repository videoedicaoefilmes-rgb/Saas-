import { requireUserOrThrow } from "@/server/session";
import { requestUpload } from "@/server/services/media";
import { assertSameOrigin, jsonError, noStore } from "@/server/http";

/** Etapa 1 do upload: devolve a URL assinada para envio direto ao armazenamento. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUserOrThrow();
    const result = await requestUpload(user.id, await request.json());
    return Response.json(result, { headers: noStore });
  } catch (err) {
    return jsonError(err);
  }
}
