# Espelhamento do GitHub para o Azure DevOps

Este repositório está configurado para **espelhar automaticamente** todo o conteúdo
do GitHub para um repositório no **Azure DevOps** (Azure Repos), de forma
**unidirecional** (GitHub → Azure DevOps).

O espelhamento é feito pelo workflow do GitHub Actions em
[`.github/workflows/mirror-azure-devops.yml`](../.github/workflows/mirror-azure-devops.yml).

## O que é espelhado

A cada `push`, criação de `tag`, remoção de branch/tag, ou execução manual:

- **Todas as branches** (`refs/heads/*`)
- **Todas as tags** (`refs/tags/*`)
- Branches/tags removidas no GitHub também são removidas no Azure DevOps (`--prune`)

> É um espelho de mão única. Alterações feitas diretamente no Azure DevOps podem
> ser sobrescritas no próximo espelhamento. Trate o GitHub como a fonte da verdade.

## Configuração (passo a passo)

### 1. Crie o repositório de destino no Azure DevOps

1. Acesse `https://dev.azure.com/` e entre na sua **organização** e **projeto**.
2. Vá em **Repos** e crie um repositório novo (ou use um existente vazio).
3. Anote a URL de clone HTTPS, que tem este formato:
   ```
   https://dev.azure.com/SUA-ORG/SEU-PROJETO/_git/SEU-REPO
   ```

### 2. Gere um Personal Access Token (PAT) no Azure DevOps

1. No Azure DevOps, clique no seu avatar → **Personal access tokens**.
2. Clique em **New Token**.
3. Defina:
   - **Organization**: a organização de destino (ou "All accessible organizations").
   - **Expiration**: escolha a validade (lembre de renovar quando expirar).
   - **Scopes**: marque **Code → Read & Write**.
4. Copie o token gerado (ele só é exibido uma vez).

### 3. Cadastre os secrets no GitHub

No repositório do GitHub, vá em **Settings → Secrets and variables → Actions →
New repository secret** e crie os dois secrets abaixo:

| Nome do secret          | Valor                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| `AZURE_DEVOPS_PAT`      | O PAT gerado no passo 2.                                               |
| `AZURE_DEVOPS_REPO_URL` | A URL do repositório **sem** o `https://`, ex.: `dev.azure.com/SUA-ORG/SEU-PROJETO/_git/SEU-REPO` |

> **Importante:** em `AZURE_DEVOPS_REPO_URL` **não** inclua `https://` nem
> credenciais — apenas o host e o caminho. O workflow monta a autenticação
> automaticamente usando o PAT.

### 4. Pronto

O espelhamento roda sozinho no próximo push. Para testar imediatamente, vá em
**Actions → Espelhar para o Azure DevOps → Run workflow** (execução manual).

## Primeira sincronização de um repositório que já tem histórico

O próprio workflow já faz um `clone --mirror`, então na primeira execução ele
envia todo o histórico existente (todas as branches e tags), não apenas o último
commit. Não é necessário nenhum passo manual adicional.

Se preferir fazer a carga inicial manualmente pela sua máquina, o comando
equivalente é:

```bash
git clone --mirror https://github.com/victorfeer/Claude-Repos.git
cd Claude-Repos.git
git push --prune \
  "https://azure-devops:SEU_PAT@dev.azure.com/SUA-ORG/SEU-PROJETO/_git/SEU-REPO" \
  'refs/heads/*:refs/heads/*' \
  'refs/tags/*:refs/tags/*'
```

## Solução de problemas

- **`Authentication failed` / HTTP 403**: PAT expirado, sem escopo
  **Code (Read & Write)**, ou pertencente a outra organização. Gere um novo PAT
  e atualize o secret `AZURE_DEVOPS_PAT`.
- **`repository not found` / HTTP 404**: verifique `AZURE_DEVOPS_REPO_URL`
  (org, projeto e nome do repo) e se o repositório existe no Azure DevOps.
- **`TF401027` (push bloqueado por política)**: alguma branch de destino tem
  *branch policy* exigindo Pull Request. Espelho envia direto na branch, então
  remova a política nas branches espelhadas do Azure DevOps ou espelhe para um
  repositório dedicado sem políticas.
- **Secrets ausentes**: o job falha com uma mensagem clara pedindo para
  configurar `AZURE_DEVOPS_PAT` e `AZURE_DEVOPS_REPO_URL`.
