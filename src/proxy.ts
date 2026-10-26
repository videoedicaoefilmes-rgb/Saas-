import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { contentSecurityPolicy } from "./server/csp";

const PROTECTED = ["/painel", "/projetos", "/processamentos", "/creditos", "/conta", "/admin"];

/**
 * 1. Aplica a Content-Security-Policy (calculada em execução).
 * 2. Redirecionamento otimista: visitantes SEM cookie de sessão vão para o login.
 *    Não é a barreira de segurança — toda página/rota valida a sessão no servidor (src/server/session.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  let response: NextResponse;
  if (isProtected && !getSessionCookie(request, { cookiePrefix: "gmclips" })) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("next", pathname);
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next();
  }
  response.headers.set("Content-Security-Policy", contentSecurityPolicy());
  return response;
}

export const config = {
  // Páginas apenas: exclui /api (uploads grandes não passam pelo proxy), arquivos estáticos e imagens.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
