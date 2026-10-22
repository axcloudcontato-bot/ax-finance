# Entrega, recuperação e portabilidade

Implementação de 20/10/2026. A implementação local não comprova ativação no servidor.

## Publicação por versão

Pré-requisitos no servidor: Docker Compose com `--wait`, Git, GitHub CLI (`gh`)
autenticado para ler os workflows do repositório e `flock`. A primeira adoção
pressupõe que o checkout corresponda à versão atualmente implantada; depois,
`.operations/releases/current_commit` registra a última publicação aprovada.

Após o commit chegar à master e os workflows **CI** e **Security checks** concluírem
com sucesso para aquele SHA:

```bash
./deploy.sh
```

Sem argumento, publica o último commit da master remota. Para publicar (ou voltar
para) um commit específico, informe o SHA completo:

```bash
./deploy.sh SHA_COMPLETO_DE_40_CARACTERES
```

Nos dois casos o script trava publicações concorrentes, confere o CI do commit exato
(recusa se ainda não concluiu com sucesso), preserva as imagens anteriores com tags
locais (pelo ID da imagem ou, quando o armazenamento do containerd não aceita o ID,
pelo nome; se nenhum funcionar, avisa e segue sem o retorno automático das imagens), constrói a versão nova sem parar os
serviços, gera backup e ensaia sua restauração antes das migrations. Só depois
atualiza web e worker e aguarda os health checks.

Durante a captura anterior à publicação, o backup agendado é pausado para evitar
duas gravações no mesmo volume; o agendamento é retomado inclusive após falha.

Cada tentativa cria `.operations/releases/<data-SHA>/result.json` e `restore.log`.
Não há limpeza automática das imagens de retorno. Retenha pelo menos as duas
últimas versões aprovadas; faça a limpeza durante manutenção planejada.

Se os serviços falharem e as migrations não tiverem mudado, o script tenta voltar
às imagens anteriores usando o Compose preservado. Se uma migration nova tiver
começado, não restaura o banco nem executa downgrade automaticamente: preserva
os dados e cria `recovery-required`. Novas publicações ficam bloqueadas.

## Recuperação após falha de migração

1. Leia `result.json`, o log do serviço `migrate` e o backup da tentativa.
2. Prefira uma correção progressiva da migration. Voltar somente a aplicação
   exige comprovar compatibilidade com o schema parcialmente ou totalmente migrado.
3. Restaure o backup em um ambiente isolado para conferir dados e anexos.
4. Uma restauração do banco em produção exige interromper escritas e contabilizar
   os eventos posteriores ao backup. Nunca substitua silenciosamente o banco ativo.
5. Após recuperar e validar web, worker e dados, registre o SHA efetivamente ativo
   em `current_commit`, documente a decisão junto à evidência e remova o marcador
   `recovery-required` para liberar a próxima publicação.

Falhas anteriores às migrations preservam a aplicação ativa. O checkout pode
ficar no commit tentado; o registro `current_commit` mantém a referência correta
para a próxima tentativa.

## Ensaio periódico de recuperação

O serviço `restore-drill` restaura o último backup em um PostgreSQL temporário
dentro de seu próprio container e valida a existência, o tamanho e o SHA-256 de
cada anexo local contra os registros restaurados. Exige schema e migrations
presentes. Não conecta ao banco ativo.

O primeiro ensaio ocorre na inicialização e os seguintes a cada 168 horas.
Logs ficam no volume `restore_evidence` por 90 dias. O evento de conclusão registra
o tempo de restauração e a idade do backup. O worker alerta sobre falha ou evidência
com mais de oito dias, respeitando o canal de alertas configurado.

Variáveis:

```dotenv
RESTORE_DRILL_INTERVAL_HOURS=168
RESTORE_DRILL_MAX_AGE_SECONDS=691200
EXTERNAL_BACKUP_REQUIRED=true
```

Ative `EXTERNAL_BACKUP_REQUIRED` somente junto da cópia externa já configurada
(`docker compose --profile external-backup up -d backup-copy`). A flag monitora
a cópia; não contrata bucket nem cria credenciais. Backups locais, sozinhos, não
protegem contra perda do servidor. Confira o objeto remoto e ensaie também a
recuperação a partir dele.

O ensaio local recusa aprovação se encontrar anexos S3: o arquivo do volume local
não comprova recuperação desses objetos. Antes de adotar S3, acrescente a
recuperação das versões do bucket ao procedimento.

## Exportação da empresa

`/api/exports/company` mantém o JSON, agora na versão 2. `?format=zip` inclui:

- `dados.json`: registros e relações, inclusive dívidas, bens, metas, regras e versões.
- `planilhas/*.csv`: CSV UTF-8 com ponto e vírgula; valores monetários em centavos.
- `relatorios/*.pdf`: os bytes originais dos relatórios preservados.
- `anexos/*`: um arquivo por ID, com nome original no inventário.
- `manifesto.json`: contagens, tamanho, SHA-256 e anexos indisponíveis.
- `LEIA-ME.txt`: instruções e situação completa ou parcial do pacote.

Anexos infectados ou não liberados quando a varredura é obrigatória ficam fora.
Arquivos ausentes ou com hash divergente são identificados, sem expor detalhes
internos de armazenamento. Descrições que poderiam virar fórmulas são
neutralizadas nos CSVs. O JSON preserva centavos como strings exatas.

A leitura dos registros usa uma única fotografia transacional; os anexos são
lidos e conferidos depois. Exclusão física concorrente de um anexo pode gerar
uma pendência explícita. O ZIP é transmitido incrementalmente; os registros JSON
e um anexo por vez permanecem em memória. Este pacote serve à portabilidade,
não substitui o backup do servidor.

## Patrimônio e relatórios

Direitos e obrigações comuns entram pelo saldo ainda pendente, com competência
até hoje; baixas futuras ainda não abatem esse saldo. Faturas e grupos de parcelas
das dívidas ficam exclusivamente nos módulos correspondentes. A composição
permite abrir o lançamento original. O alcance continua limitado aos registros e
ao acesso do perfil, com contas/cofrinhos ativos e bens cadastrados manualmente.

As leituras compostas usam `RepeatableRead` e `READ ONLY`, propagados somente
dentro do escopo explícito de leitura, com proteção contra troca de usuário ou
empresa. A captura do fechamento começa depois da trava do período; a gravação
da versão continua na transação de fechamento.

## Validação local em 20/10/2026

- **Integração e unidade:** 496 testes aprovados em 84 arquivos, com PostgreSQL real.
- **Tipos:** verificação de banco, domínio, worker e web aprovada.
- **Lint:** nenhum erro; permanecem nove avisos anteriores em outros componentes.
- **Compilação:** build de produção do Next concluído no Windows.
- **Navegador:** os dez cenários da suíte foram validados, contando o login.
  A execução inicial aprovou nove; após ajustar seletores e espera de navegação
  do novo teste de cartão, os cenários novos foram reexecutados com sucesso.
  Conferidos saldo e limite após antecipação, pagamento e seus estornos,
  preservação dos formulários sobrepostos, histórico do fechamento, ZIP/JSON e
  apresentação do patrimônio em desktop e celular.
- **Publicação simulada:** seis cenários aprovados — sucesso, CI reprovado,
  falha de build, falha de backup, falha de saúde com retorno e falha de migração
  com bloqueio para recuperação. Esses testes não utilizam Docker nem GitHub reais.

**Pendente no ambiente operacional:** executar o job de restauração em Docker,
validar o build Linux/standalone no CI, ativar os serviços e canais de alerta no
servidor e comprovar a cópia externa. Docker não está disponível neste computador.
Nenhuma publicação ou alteração de dados de produção foi realizada nesta entrega.
