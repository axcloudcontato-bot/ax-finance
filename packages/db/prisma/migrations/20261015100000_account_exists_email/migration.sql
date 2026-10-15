-- Cadastro com e-mail que já tem conta: a tela responde igual a um cadastro novo
-- (não revela quem tem conta) e o dono do e-mail recebe um aviso para entrar ou
-- redefinir a senha.
ALTER TYPE "OutboxEventType" ADD VALUE 'ACCOUNT_EXISTS';
