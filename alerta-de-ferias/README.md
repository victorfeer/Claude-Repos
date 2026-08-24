# Alerta de Férias a Vencer

Desenvolvimento para o **Sankhya Om** que evita que colaboradores acumulem um
segundo período de férias (pagamento em dobro por força da CLT), avisando o DP,
o colaborador (via líder) e o sistema (pop-up/sino) com antecedência.

Esta pasta reúne a **documentação consolidada** e o **painel HTML5** finais.
O código-fonte validado em produção vive no ambiente/Azure DevOps do time — aqui
fica a documentação de referência e o gadget entregável.

## ⚠️ Errata — artefato implantado

A documentação inicial foi escrita antes do acesso ao artefato real
(`alertaferias.jar`, projeto `AlertaFeriasHml`, classes de **10/07/2026**).
A decompilação corrigiu vários pontos:

| Documentado antes | Realidade |
|---|---|
| Procedure com 6 parâmetros (`P_CODGRUPO`) | **5 parâmetros** — `P_CODGRUPO` não existe |
| Sino vai para um grupo | **8 `CODUSU`**: 1716, 1945, 1946, 1947, 2365, 3379, 3387, 3388 |
| Limite de gozo = `DTFINAQUI + 330` | **`FER.DTLIMGOZFER`** (fallback `ADD_MONTHS(DTFINAQUI,12)`) |
| Job consome a view | **Não usa a view** — SQL próprio, regras diferentes |
| Chave da `AD_FERIAS_NOTIFICADO` | `(CODEMP, CODFUNC, **SEQUENCIA**)` |
| Interface Cuckoo e JNDI pendentes | **Resolvidas** — ver `docs/divergencia-view-x-job.md` |

**Bloqueio para produção:** o artefato tem `MODO_TESTE = true`. Por ser constante
de compilação, o ramo de produção é eliminado do bytecode — todo e-mail vai para
o endereço de teste, incondicionalmente. Ir para produção exige **recompilar**.

Detalhes: [`docs/divergencia-view-x-job.md`](docs/divergencia-view-x-job.md),
scripts corrigidos em [`sql/`](sql) e código real em [`fonte-java/`](fonte-java).

## Conteúdo

| Arquivo | O que é |
|---|---|
| [`docs/documentacao-consolidada.md`](docs/documentacao-consolidada.md) | Visão geral: objetivo, arquitetura, regras A/B, glossário. |
| [`docs/sql-objetos.md`](docs/sql-objetos.md) | DDL da view/procedure/tabelas + troubleshooting de banco. |
| [`docs/java-job.md`](docs/java-job.md) | Ação Agendada `AlertaFeriasNotificacao`, fila `TMDFMG`, SMTP. |
| [`docs/frontend-e-deploy.md`](docs/frontend-e-deploy.md) | Painel, deploy, homologação e a navegação do drill-through. |
| [`painel/index.html`](painel/index.html) | Gadget HTML5 do painel (fonte do `.zip` de importação). |

## Componentes da solução

- **View Oracle** `VW_ALERTA_FERIAS_A_VENCER` — fonte única da regra de elegibilidade.
- **Procedure** `STP_NOTIFICA_SISTEMA_CUSTOM` — grava avisos no sino/pop-up nativo.
- **Tabelas** `AD_FERIAS_NOTIFICADO` (deduplicação) e `AD_FERIAS_CONFIG` (parâmetros de e-mail).
- **Ação Agendada Java** `AlertaFeriasNotificacao` — roda diariamente.
- **Fila de e-mail nativa** `TMDFMG`.
- **Painel HTML5** — consulta com filtros, KPIs clicáveis, detalhe (accordion) e
  drill-through para a tela de **Requisições** (`br.com.sankhya.rh.Requisicoes`).

## Painel — drill-through "Abrir requisição de férias"

O botão abre a tela de Requisições como **aba interna** do Sankhya, na **mesma
sessão** (sem aba de navegador, sem novo login, sem reload), via:

```js
workspace.openActivityResourceID("br.com.sankhya.rh.Requisicoes");
```

**Detalhe crítico:** o objeto `workspace` não está nos frames-pai do gadget — ele
vive num **iframe irmão**, alcançável **descendo** do `top` por todos os iframes
(`document.querySelectorAll('iframe')` → `contentWindow.workspace`). Procurar
apenas subindo a cadeia de pais **não** acha o `workspace`. Ver detalhes em
[`docs/frontend-e-deploy.md`](docs/frontend-e-deploy.md).
