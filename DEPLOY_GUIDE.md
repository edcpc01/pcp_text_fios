# 🚀 Guia de Implantação — 100% pelo Browser
> Nenhuma instalação local necessária. Tudo via interfaces web.

---

## VISÃO GERAL

| Etapa | Serviço | Tempo |
|-------|---------|-------|
| 1. Repositório | GitHub.com | 5 min |
| 2. Firebase | console.firebase.google.com | 10 min |
| 3. Variáveis | Vercel dashboard | 5 min |
| 4. Deploy automático | Vercel (CI/CD) | automático |
| 5. Usuário admin | Firebase Console | 3 min |
| 6. Seed de dados | Firebase Console | 5 min |

---

## PASSO 1 — Subir arquivos no GitHub

### 1a. Criar o repositório (se ainda não existir)
1. Acesse https://github.com/new
2. Nome: `corradi-pwa`
3. Visibilidade: **Private**
4. Clique em **"Create repository"**

### 1b. Fazer upload dos arquivos pelo browser

No seu repositório, clique em **"Add file" → "Upload files"**.

Faça upload **respeitando as pastas**. O GitHub permite arrastar pastas inteiras:

**Extraia o ZIP** `corradi-pwa-deploy.zip` no seu computador primeiro, depois:

#### Upload 1 — Arquivos da raiz
Arraste para o GitHub (raiz do repositório):
```
firebase.json
firestore.rules
firestore.indexes.json
index.html          ← substitui o existente
vite.config.js      ← substitui o existente
DEPLOY_GUIDE.md
FIREBASE_SETUP.md
```

#### Upload 2 — Pasta `functions/`
- Clique em **"Add file" → "Upload files"**
- Arraste a pasta `functions/` inteira
- O GitHub vai criar `functions/index.js`, `functions/package.json`, `functions/.eslintrc.json`

#### Upload 3 — Pasta `public/`
- Clique em **"Add file" → "Upload files"**
- Arraste a pasta `public/` inteira (com subpasta `icons/`)

#### Upload 4 — Pasta `src/`
- Clique em **"Add file" → "Upload files"**
- Arraste a pasta `src/` inteira
- Vai adicionar `src/pages/Login.jsx`, `Planning.jsx`, `Production.jsx`
- Vai adicionar `src/hooks/usePWA.js`
- Vai adicionar `src/components/PWAPrompt.jsx`

#### Upload 5 — Pasta `scripts/`
- Arraste a pasta `scripts/`

> 💡 **Dica**: No final de cada upload, coloque uma mensagem de commit como "feat: add firebase config" e clique em **"Commit changes"**.

---

## PASSO 2 — Criar projeto no Firebase Console

1. Acesse https://console.firebase.google.com
2. Clique em **"Adicionar projeto"**
3. Nome: `corradi-production`
4. Desative Google Analytics → **"Criar projeto"**

### 2a. Ativar Firestore
- Menu esquerdo → **Firestore Database** → **"Criar banco de dados"**
- Modo: **"Iniciar no modo de produção"**
- Região: **`southamerica-east1`** (São Paulo) → **Ativar**

### 2b. Ativar Authentication
- Menu esquerdo → **Authentication** → **"Começar"**
- Aba **"Sign-in method"** → **E-mail/senha** → Ativar → **Salvar**

### 2c. Upgrade para plano Blaze (necessário para Functions)
- ⚙️ Configurações do projeto → **"Uso e faturamento"**
- Clique **"Fazer upgrade"** → **Blaze** → siga os passos
- ⚠️ Requer cartão de crédito, mas o uso previsto fica dentro do tier gratuito (~$0/mês)

### 2d. Registrar o app Web
1. ⚙️ Configurações do projeto → aba **"Seus apps"** → ícone **`</>`** (Web)
2. Nome: `corradi-pwa` → **"Registrar app"**
3. **Copie** as credenciais exibidas — você vai precisar delas no Passo 3:
```
apiKey: "AIzaSy..."
authDomain: "corradi-production.firebaseapp.com"
projectId: "corradi-production"
storageBucket: "corradi-production.appspot.com"
messagingSenderId: "123456789"
appId: "1:123456789:web:abcdef"
```

---

## PASSO 3 — Conectar Vercel ao GitHub e configurar variáveis

### 3a. Importar projeto (se ainda não estiver na Vercel)
1. Acesse https://vercel.com/new
2. Clique em **"Import Git Repository"**
3. Selecione o repositório `corradi-pwa`
4. Framework: **Vite** (detectado automaticamente)
5. **Não clique em Deploy ainda** — primeiro configure as variáveis

### 3b. Adicionar variáveis de ambiente na Vercel
Ainda na tela de import (ou depois em **Settings → Environment Variables**):

Adicione cada uma das variáveis abaixo:

| Nome | Valor |
|------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` (do passo 2d) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `corradi-production.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `corradi-production` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `corradi-production.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `VITE_FIREBASE_APP_ID` | `1:123456789:web:abcdef` |

Marque todas como: ✅ Production ✅ Preview ✅ Development

### 3c. Fazer o primeiro deploy
- Clique em **"Deploy"**
- Aguarde ~2 minutos
- A Vercel vai dar uma URL como `corradi-pwa.vercel.app`

> A partir de agora, **todo push no GitHub faz deploy automático na Vercel**.

---

## PASSO 4 — Ativar regras e índices do Firestore pelo Console

O Firebase Console permite configurar as regras direto pela interface:

### 4a. Regras de segurança
1. **Firestore Database** → aba **"Regras"**
2. Apague o conteúdo atual e cole o conteúdo do arquivo `firestore.rules` do ZIP
3. Clique em **"Publicar"**

### 4b. Índices compostos
Os índices são criados automaticamente quando a aplicação faz a primeira query.
Mas para adiantar, você pode criá-los manualmente:

1. **Firestore Database** → aba **"Índices"** → **"Criar índice"**

Crie os seguintes índices (um por vez):

**Índice 1:**
- Coleção: `planning_entries`
- Campos: `factory` (Crescente) + `date` (Crescente)
- Escopo: Coleção

**Índice 2:**
- Coleção: `production_records`
- Campos: `factory` (Crescente) + `date` (Crescente)
- Escopo: Coleção

**Índice 3:**
- Coleção: `production_records`
- Campos: `factory` (Crescente) + `machine` (Crescente) + `date` (Crescente)
- Escopo: Coleção

> ⏱️ Cada índice leva ~2 minutos para ficar ativo.

---

## PASSO 5 — Deploy das Cloud Functions pelo Console

### 5a. Acessar Cloud Functions
1. No Firebase Console → menu esquerdo → **"Functions"**
2. Clique em **"Começar"** se for a primeira vez

### 5b. Configurar secrets (variáveis secretas)
As Cloud Functions precisam de chaves secretas. Configure pelo **Google Cloud Console**:

1. Acesse https://console.cloud.google.com
2. Selecione o projeto `corradi-production` no menu superior
3. Menu → **"APIs e serviços"** → **"Secret Manager"**
4. Clique em **"+ Criar secret"** para cada um:

| Nome do secret | Valor |
|----------------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (sua chave Anthropic) |
| `MICRODATA_API_URL` | URL da API Microdata (pode deixar vazio por ora) |
| `MICRODATA_API_KEY` | Chave da API Microdata (pode deixar vazio por ora) |
| `MICRODATA_TENANT_ID` | ID do tenant Microdata (pode deixar vazio por ora) |

> 💡 Para criar a chave Anthropic: https://console.anthropic.com → API Keys → Create Key

### 5c. Deploy das Functions via GitHub Actions (recomendado)

A forma mais simples de fazer deploy das Functions sem CLI local é via **GitHub Actions**.

No GitHub, crie o arquivo `.github/workflows/firebase-deploy.yml`:

1. No repositório GitHub → **"Add file" → "Create new file"**
2. Nome do arquivo: `.github/workflows/firebase-deploy.yml`
3. Cole o conteúdo abaixo:

```yaml
name: Deploy Firebase Functions

on:
  push:
    branches: [ main ]
    paths:
      - 'functions/**'
      - 'firestore.rules'
      - 'firestore.indexes.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Functions deps
        run: cd functions && npm ci

      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only functions,firestore:rules,firestore:indexes
        env:
          GCP_SA_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

4. Clique em **"Commit changes"**

### 5d. Adicionar a chave de serviço Firebase no GitHub

Para o GitHub Actions conseguir fazer deploy no Firebase:

1. **Firebase Console** → ⚙️ Configurações do projeto → **"Contas de serviço"**
2. Clique em **"Gerar nova chave privada"** → confirme → o arquivo JSON é baixado
3. No GitHub → repositório → **Settings → Secrets and variables → Actions**
4. Clique em **"New repository secret"**
   - Nome: `FIREBASE_SERVICE_ACCOUNT`
   - Valor: cole o conteúdo **inteiro** do arquivo JSON baixado
5. Clique em **"Add secret"**

### 5e. Disparar o deploy
Faça qualquer commit na pasta `functions/` para acionar o workflow, ou:
- GitHub → aba **"Actions"** → selecione o workflow → **"Run workflow"**

---

## PASSO 6 — Criar usuário administrador

### 6a. Criar usuário no Firebase Auth
1. **Firebase Console** → **Authentication** → **Users**
2. Clique em **"Add user"**
3. E-mail: `admin@corradi.com.br`
4. Senha: (defina uma senha forte)
5. Clique em **"Add user"**
6. **Copie o UID** exibido na lista (ex: `xYz123abc456`)

### 6b. Criar documento do usuário no Firestore
1. **Firestore Database** → **"Iniciar coleção"**
2. ID da coleção: `users` → **Avançar**
3. ID do documento: cole o **UID** copiado
4. Adicione os campos:

| Campo | Tipo | Valor |
|-------|------|-------|
| `role` | string | `admin` |
| `name` | string | `Administrador` |
| `email` | string | `admin@corradi.com.br` |
| `factory` | string | `corradi` |

5. Clique em **"Salvar"**

---

## PASSO 7 — Popular com dados iniciais (Seed pelo Console)

Para ter dados de demonstração sem rodar scripts locais, use o **Importador do Firestore**:

### Opção A — Inserir dados manualmente pelo Console
1. **Firestore** → **"Iniciar coleção"** → `machines`
2. Adicione alguns documentos de máquinas manualmente para testar

### Opção B — Usar o app direto (mais fácil)
O app já tem `seedDemoData()` que popula automaticamente quando não há dados no Firestore. Basta abrir o app e navegar para Planning ou Production — os dados demo aparecem automaticamente.

---

## PASSO 8 — Adicionar PWAPrompt no Layout

No GitHub, edite o arquivo `src/components/Layout.jsx`:

1. Clique no arquivo → ícone de lápis ✏️ (Edit)
2. No início do arquivo, adicione o import:
```jsx
import PWAPrompt from './PWAPrompt';
```
3. Dentro do `return`, antes do último `</div>`, adicione:
```jsx
<PWAPrompt />
```
4. Clique em **"Commit changes"** — a Vercel faz deploy automático

---

## PASSO 9 — Verificar tudo funcionando ✅

| Teste | Como verificar |
|-------|---------------|
| App abre | Acesse a URL da Vercel |
| Login funciona | Entre com o usuário criado no Passo 6 |
| Planning carrega | Menu → Planejamento |
| Production carrega | Menu → Realizado |
| PWA instalável | Chrome → ícone de instalação na barra de endereço |
| Functions ativas | Firebase Console → Functions → lista as 3 funções |

---

## ⚠️ PROBLEMAS COMUNS

**"Missing or insufficient permissions"**
→ O documento `/users/{uid}` não existe ou o campo `role` está errado (Passo 6b)

**Build falha na Vercel com erro de import**
→ Verifique se todos os arquivos foram commitados corretamente no GitHub

**Functions não aparecem no Console**
→ O GitHub Actions pode ter falhado — verifique a aba **Actions** no GitHub

**Índices com status "Building"**
→ Aguarde até 5 minutos; eles ficam ativos sozinhos

**PWA não instala no iPhone**
→ Abra pelo Safari → compartilhar → "Adicionar à Tela Inicial"
