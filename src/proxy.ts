import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Redirecionamento otimista: visitantes SEM cookie de sessão vão para o login.
 * Não é a barreira de segurança — toda página/rota valida a sessão no servidor (src/server/session.ts).
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request, { cookiePrefix: "gmclips" }));
  if (!hasSession) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/projetos/:path*", "/processamentos/:path*", "/creditos/:path*", "/conta/:path*", "/admin/:path*"],
};
