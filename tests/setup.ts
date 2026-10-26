// Carrega o ambiente de testes antes de qualquer módulo da aplicação.
process.loadEnvFile(".env.test");
(process.env as Record<string, string>).NODE_ENV = "test";
