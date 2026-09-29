# Operação de produção

Este documento descreve o mínimo operacional do AX Finance: backup, restauração,
health checks, métricas, alertas, diagnóstico, logs e retenção. Os comandos partem
do diretório do projeto no servidor.

## 1. Backup automático

O serviço `backup` inicia junto com o Compose e executa imediatamente um backup.
Depois, repete conforme `BACKUP_INTERVAL_HOURS` (24 horas por padrão). Cada execução
produz uma pasta imutável:

```text
.backups/backup-AAAAMMDDThhmmssZ/
  database.dump
  attachments.tar.gz
  metadata.json
  SHA256SUMS
```

`database.dump` usa o formato custom do PostgreSQL e preserva as permissões. O
arquivo de anexos contém o volume privado, e `SHA256SUMS` detecta corrupção. A
publicação só atualiza `.last_success` depois que todos os arquivos e checksums
foram concluídos.

Configuração recomendada no `.env`:

```dotenv
BACKUP_HOST_DIR=/var/backups/ax-finance
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=30
BACKUP_MAX_AGE_SECONDS=129600
```

O diretório deve estar em disco cifrado, com acesso apenas ao administrador. Um
backup no mesmo servidor não protege contra perda total da máquina: replique
`BACKUP_HOST_DIR` para armazenamento externo cifrado e versionado. Nunca envie
o diretório para Git.

Verificação diária:

```bash
docker compose ps backup
docker compose logs backup --tail 50
head -n 2 /var/backups/ax-finance/.last_success
```

## 2. Teste seguro de restauração

O teste cria um PostgreSQL efêmero dentro de um container, confere os checksums,
restaura o dump, valida as migrations e extrai os anexos. Ele não acessa nem
altera o banco de produção:

```bash
OPERATION_OPERATOR=seu-usuario sh ./ops/run-restore-verification.sh
```

Resultado esperado: evento JSON `restore_verify.completed` e código de saída 0.
Execute após o primeiro deploy e, no mínimo, mensalmente. Registre data, operador,
backup testado, duração e resultado no controle de mudanças da empresa. O wrapper
grava log, checksum e resultado em `.operations/evidence/restore`.

### Restauração real em incidente

1. Confirme o incidente e escolha um backup cujo `SHA256SUMS` tenha sido validado.
2. Preserve uma cópia do estado atual antes de qualquer alteração.
3. Coloque o sistema em manutenção e pare `web`, `worker` e `backup`.
4. Em um PostgreSQL novo, aplique as migrations uma vez para criar o role `ax_app`.
5. Recrie o banco vazio e restaure `database.dump` com `pg_restore --exit-on-error`.
6. Restaure `attachments.tar.gz` no volume de anexos mantendo acesso privado.
7. Reaplique a senha de produção do role `ax_app`; ela não é guardada no backup.
8. Suba `web` e `worker`, execute os health checks e confira saldos, anexos e login.
9. Mantenha o estado anterior até a conferência funcional e financeira terminar.

Faça esse procedimento primeiro em homologação. A restauração real é destrutiva
e deve ter autorização explícita e dupla conferência do destino.

## 3. Health checks

Rotas públicas sem informações de negócio:

- `GET /api/health/live`: processo web em execução.
- `GET /api/health/ready`: banco acessível e volume de anexos gravável.

O Compose também verifica:

- PostgreSQL com `pg_isready`;
- web pela rota de readiness;
- worker pelo heartbeat atualizado a cada ciclo;
- backup pela idade de `.last_success`.

Após cada deploy:

```bash
sh ./ops/smoke-check.sh
docker compose ps
```

Um container `unhealthy` deve bloquear novas publicações até o diagnóstico.

## 4. Métricas e alertas

As métricas Prometheus exigem um token de no mínimo 24 caracteres:

```bash
curl -H "Authorization: Bearer $METRICS_TOKEN" \
  https://SEU_DOMINIO/api/metrics
```

Métricas cobrem disponibilidade, latência do banco, estados da outbox, idade da
fila, jobs agendados e importações com falha/atraso/lock expirado, idade do backup
e heartbeat do worker.
Configure o coletor para nunca registrar o header de autorização.

Regras iniciais para Prometheus/Alertmanager estão em
[`ops/prometheus-alerts.yml`](../ops/prometheus-alerts.yml). Ajuste o seletor
`job="ax-finance"` ao nome usado no seu coletor antes de carregá-las.

O worker emite alertas estruturados para:

- dead letter;
- evento pendente antigo;
- job com falha, atraso ou lock expirado;
- importação com falha definitiva, atraso ou lock expirado;
- backup ausente ou vencido.

`ALERT_WEBHOOK_URL` é opcional. Sem webhook, os alertas continuam nos logs. O
destino deve aceitar `POST` JSON. Use um endpoint dedicado e rotacione seu segredo.
Valide a entrega com `OPERATION_OPERATOR=seu-usuario sh ./ops/test-alert-webhook.sh`;
o comando retorna erro quando a URL estiver ausente ou o destino rejeitar o POST.

Para encaminhar métricas a um provedor externo compatível com Prometheus Remote
Write, configure as variáveis `PROMETHEUS_REMOTE_WRITE_*` e execute
`docker compose --profile monitoring up -d metrics-agent`. O Alloy mantém fila
local no volume `alloy_data`. As regras continuam em `ops/prometheus-alerts.yml`.

## 5. Diagnóstico de jobs

O endpoint interno retorna somente identificadores técnicos, tipos, tentativas,
datas e fingerprints de erro, incluindo a fila de importações; não retorna
payloads, nomes de arquivo, e-mails ou valores:

```bash
curl -H "Authorization: Bearer $OPERATIONS_TOKEN" \
  https://SEU_DOMINIO/api/ops/diagnostics
```

Nunca publique `METRICS_TOKEN`, `OPERATIONS_TOKEN` ou o webhook em tickets e logs.
Para investigar um ID, correlacione-o com os eventos JSON do worker. Eventos em
dead letter não são reprocessados automaticamente. Depois de corrigir a causa,
use o painel interno: ele valida o estado, preserva o payload cifrado e registra
a intervenção na auditoria administrativa.

## 6. Logs estruturados

Web, worker e backup escrevem uma linha JSON por evento com `timestamp`, `level`,
`service` e `event`. Erros persistem apenas uma fingerprint técnica; campos com
nomes sensíveis são censurados. Payloads financeiros, tokens, nomes e endereços de
e-mail não devem ser adicionados aos logs.

O driver `json-file` é limitado por `LOG_MAX_SIZE` e `LOG_MAX_FILES`, evitando que
logs preencham o disco. Se houver centralização, mantenha acesso restrito, TLS e
retenção compatível com a política abaixo.

## 7. Retenção e LGPD

Limpeza automática diária do worker:

| Dado | Padrão | Regra |
|---|---:|---|
| Outbox processada | 30 dias | payload já é removido no processamento |
| Dead letter | 90 dias | contém apenas payload cifrado e fingerprint |
| Fonte temporária de importação | até concluir ou falhar | removida pelo web/worker após o processamento; volume não entra no backup |
| Jobs de importação concluídos/com falha | 30/90 dias | o lote e as linhas financeiras permanecem; só o estado técnico da fila expira |
| Sessões/tokens/desafios/rate limit expirados | 30 dias | contados após a expiração/última atualização |
| Backups locais | 30 dias | controlado por `BACKUP_RETENTION_DAYS` |
| Logs Docker | por tamanho | 10 MB × 5 arquivos por serviço, por padrão |

Registros financeiros, auditoria e anexos não são apagados por essa limpeza. A
empresa deve definir base legal, prazo contratual/fiscal, legal hold e processo de
eliminação antes de automatizar a exclusão desses dados. Solicitações de titulares
devem ser avaliadas sem destruir registros que a empresa tenha obrigação de manter.

Revisar trimestralmente: acessos aos backups, sucesso da restauração, volumes de
logs, dead letters, prazos configurados, fornecedores/subprocessadores e incidentes.

## 8. Anexos em múltiplas instâncias

O volume local continua sendo o padrão para uma única instância. Quando houver
mais de uma instância web, configure armazenamento privado compatível com S3:

```env
ATTACHMENT_STORAGE_BACKEND=s3
S3_BUCKET=ax-finance-anexos
S3_REGION=sa-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Para MinIO ou outro serviço compatível, informe também `S3_ENDPOINT` e, quando
necessário, `S3_FORCE_PATH_STYLE=true`. O bucket não deve ser público.
As credenciais precisam de leitura, gravação, exclusão e `HeadBucket`/consulta
do bucket, usada pelo health check de prontidão.
Ao usar S3, o `attachments.tar.gz` do job local deixa de ser a cópia dos
anexos: habilite versionamento, criptografia, política de retenção e replicação
ou backup do próprio bucket.

A cópia externa dos backups locais pode ser ativada com o perfil
`external-backup`. Configure `BACKUP_REMOTE` e um arquivo rclone privado em
`RCLONE_CONFIG_HOST_PATH`, então execute
`docker compose --profile external-backup up -d backup-copy`. O processo copia
pastas completas de forma imutável e não remove versões do destino.

Para bloquear arquivos até a validação antivírus, disponibilize um daemon
ClamAV (`clamd`) na rede privada e ative:

```env
ATTACHMENT_SCAN_REQUIRED=true
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
```

Com a verificação obrigatória, indisponibilidade do antivírus interrompe o
upload com segurança; anexos não validados não podem ser baixados. Faça a
ativação em duas etapas: configure o scanner e valide/migre os anexos antigos
antes de mudar `ATTACHMENT_SCAN_REQUIRED` para `true`, pois registros antigos
começam com estado `NOT_SCANNED`.

## 9. Painel administrativo interno

O painel fica em `/admin` e exige uma conta normal ativa mais um papel explícito
em `platform_admins`. Ser proprietário de uma empresa não concede acesso interno.
Depois que o usuário criar a própria conta, conceda o papel usando a conexão de
migration, nunca a conexão `ax_app` da aplicação:

```bash
pnpm admin:grant administrador@empresa.com SUPER_ADMIN
```

Em produção com Docker Compose, execute pelo serviço de migração, que possui a
conexão administrativa necessária:

```bash
docker compose run --rm migrate pnpm admin:grant administrador@empresa.com SUPER_ADMIN
```

Papéis disponíveis: `SUPER_ADMIN`, `OPERATIONS`, `SUPPORT` e `ANALYST`.
`SUPER_ADMIN` pode intervir em assinaturas; `OPERATIONS` pode reprocessar jobs;
`SUPPORT` administra chamados e incidentes; `ANALYST` possui apenas leitura.

Toda alteração de assinatura, reprocessamento, chamado e incidente gera um
registro em `admin_audit_events`. Reprocessamentos só são aceitos para falhas,
atrasos ou locks expirados; jobs em execução saudável são rejeitados. Não coloque
tokens, payloads financeiros ou dados sensíveis nos campos de motivo e resumo.

## 10. Evidências e revisão de segurança

O estado da validação real, resultados medidos, critérios de aprovação e comandos
de ativação estão em [`VALIDACAO_OPERACIONAL.md`](./VALIDACAO_OPERACIONAL.md).
Execute `pnpm security:audit`, `pnpm typecheck` e `pnpm build` antes de publicar.
