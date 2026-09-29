# Validação operacional de produção

Este registro separa o que foi efetivamente exercitado do que está apenas
preparado. Evidência sem execução no servidor não deve ser marcada como aprovada.

## Estado em 29/09/2026

| Controle | Estado | Evidência |
|---|---|---|
| Health público | Aprovado | `live` e `ready` responderam HTTP 200; banco, anexos e política de antivírus ficaram prontos. |
| Endpoints operacionais sem token | Aprovado | `/api/metrics` e `/api/ops/diagnostics` responderam 404 sem credenciais. |
| Carga pública básica | Aprovado | 30/30 em `live`, 2 req/s por 15 s, p95 89,83 ms; 150/150 em `ready`, 5 req/s por 30 s, p95 68 ms. |
| Dependências de produção | Aprovado | `pnpm audit --prod --audit-level low`: nenhuma vulnerabilidade conhecida após atualização. |
| Build e tipos | Aprovado | Next.js 15.5.26 compilado; `pnpm typecheck` aprovado. |
| Restauração do backup | Aguardando servidor | O executor com evidência está pronto; precisa acessar `/var/backups/ax-finance`. |
| Webhook de alertas | Aguardando destino | O teste falha se não houver URL ou se o destino não responder 2xx. |
| Métricas externas | Aguardando credenciais | Alloy e Remote Write estão configurados; faltam URL e credenciais do provedor. |
| Cópia externa | Aguardando bucket | rclone imutável está configurado; faltam remote e credenciais. |
| S3 para anexos | Não necessário agora | O Compose possui uma única instância web e volume persistente local. Ativar antes de escalar horizontalmente. |
| ClamAV | Recomendado, não ativado | Há upload de anexos por usuários. Exige aproximadamente 4 GiB livres e validação dos arquivos antigos. |

Os relatórios detalhados dos ensaios de carga ficam em `.operations/evidence/load`
e são ignorados pelo Git por poderem identificar topologia operacional.

## Janela de validação no servidor

Atualize as imagens antes dos testes para que o worker contenha o comando de
validação do webhook:

```bash
git pull
docker compose build web worker migrate
docker compose up -d
```

Defina o operador sem espaços e execute a restauração efêmera:

```bash
export OPERATION_OPERATOR=sergio
sh ./ops/run-restore-verification.sh
```

Critério de aprovação: saída `restore_verify.completed`, código 0 e JSON com
`"result":"passed"` em `.operations/evidence/restore`. O teste não altera o
banco de produção.

Configure `ALERT_WEBHOOK_URL` no `.env`, recrie o worker e teste:

```bash
docker compose up -d --force-recreate worker
sh ./ops/test-alert-webhook.sh
```

Critério de aprovação: código 0, evento `operations.alert_webhook_test_completed`
e confirmação visual do evento `operational_test` no destino. O HTTP 2xx prova a
entrega; a conferência no destino prova a apresentação ao operador.

## Métricas e alertas externos

O perfil `monitoring` usa Grafana Alloy para coletar `/api/metrics` sem expor o
token em argumentos e encaminhar por Prometheus Remote Write. Configure:

```dotenv
METRICS_TOKEN=valor-com-pelo-menos-24-caracteres
PROMETHEUS_REMOTE_WRITE_URL=https://destino/api/prom/push
PROMETHEUS_REMOTE_WRITE_USERNAME=usuario
PROMETHEUS_REMOTE_WRITE_PASSWORD=segredo
DEPLOY_ENVIRONMENT=production
```

Depois:

```bash
docker compose --profile monitoring up -d metrics-agent
docker compose logs metrics-agent --tail 100
```

No provedor, carregue `ops/prometheus-alerts.yml`, ajustando o seletor
`job="ax-finance"` se necessário. Critérios: série `up{job="ax-finance"}` atual,
ausência de erro de Remote Write e disparo/normalização de uma regra de teste.
As credenciais do provedor não devem entrar no Git nem em tickets.

## Cópia externa dos backups

Crie um remote rclone cifrado em `.secrets/rclone.conf` e limite a credencial a
um bucket exclusivo. O processo usa `copy --immutable`: nunca apaga nem
sobrescreve o histórico remoto. Configure, por exemplo:

```dotenv
BACKUP_REMOTE=s3:ax-finance-backups/production
RCLONE_CONFIG_HOST_PATH=./.secrets/rclone.conf
BACKUP_COPY_INTERVAL_HOURS=24
BACKUP_COPY_MAX_AGE_SECONDS=129600
```

```bash
chmod 600 .secrets/rclone.conf
docker compose --profile external-backup up -d backup-copy
docker compose logs backup-copy --tail 100
docker compose ps backup-copy
```

Critério: evento `backup_copy.completed`, container saudável e os quatro arquivos
do último backup visíveis no bucket. Ative no bucket versionamento, criptografia,
retenção/immutability e regra de ciclo de vida; retenção remota não é executada
pelo AX Finance.

## S3 e ClamAV

S3 passa a ser obrigatório quando houver mais de uma instância web ou disco
efêmero. Nesse momento, migre anexos, ative versionamento e criptografia do bucket,
configure `ATTACHMENT_STORAGE_BACKEND=s3` e somente então recrie o web.

Para uploads públicos, reserve 4 GiB de RAM e inicie o scanner sem bloqueio:

```bash
docker compose --profile attachment-security up -d clamav
docker compose ps clamav
```

Após o ClamAV ficar saudável, configure `CLAMAV_HOST=clamav` e valide o endpoint
`ready`. Faça inventário/varredura dos anexos antigos. Por fim defina
`ATTACHMENT_SCAN_REQUIRED=true`, recrie o web e confirme que `ready` continua 200.
O clamd não publica porta no host; ele permanece apenas na rede do Compose.

## Carga e revisão recorrente

O teste versionado limita por padrão a 5 req/s por 30 segundos e só permite os
health checks. Exemplo:

```bash
LOAD_BASE_URL=https://axfinance.axcloud.com.br \
LOAD_PATH=/api/health/ready \
LOAD_DURATION_SECONDS=30 \
LOAD_REQUESTS_PER_SECOND=5 \
pnpm ops:load-test
```

Esse ensaio é um baseline operacional, não mede capacidade dos fluxos autenticados.
Antes de aumentar a taxa ou testar rotas financeiras, use homologação com dados
sintéticos, defina limite/tempo de abortagem e monitore CPU, RAM, conexões e p95.

O GitHub executa auditoria, tipos e build em pushes, pull requests e semanalmente.
O Dependabot verifica pacotes npm e imagens Docker semanalmente. Headers globais
adicionados: HSTS, bloqueio de iframe, `nosniff`, política de referência e bloqueio
de câmera/microfone/geolocalização.
