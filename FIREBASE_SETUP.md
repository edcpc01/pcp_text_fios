# Firebase Setup — Corradi Production Planner

## 1. Pré-requisitos

```bash
npm install -g firebase-tools
firebase login
```

## 2. Criar projeto Firebase

1. Acesse https://console.firebase.google.com
2. Crie projeto: `corradi-production`
3. Ative **Firestore** (modo produção)
4. Ative **Authentication** → Email/Senha
5. Ative **Cloud Functions** (plano Blaze obrigatório)

## 3. Configurar variáveis de ambiente

```bash
# Secrets das Cloud Functions
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set MICRODATA_API_KEY
firebase functions:secrets:set MICRODATA_API_URL
firebase functions:secrets:set MICRODATA_TENANT_ID
```

## 4. Instalar dependências das Functions

```bash
cd functions
npm install
cd ..
```

## 5. Deploy das regras e índices

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 6. Deploy das Cloud Functions

```bash
firebase deploy --only functions
```

## 7. Seed inicial (emulador local)

```bash
# Iniciar emulador
firebase emulators:start

# Em outro terminal, rodar o seed
cd scripts
npm install firebase-admin
node seed-firestore.js
```

## 8. Configurar .env do frontend

Copie `.env.example` para `.env.local` e preencha com os valores do Firebase Console:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=corradi-production.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=corradi-production
VITE_FIREBASE_STORAGE_BUCKET=corradi-production.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 9. Criar primeiro usuário admin

No Firebase Console → Authentication → Add user:
- Email: admin@corradi.com.br
- Senha: (definir)

Depois no Firestore → Coleção `users` → Documento com UID do usuário:
```json
{
  "role": "admin",
  "name": "Administrador",
  "factory": "corradi",
  "email": "admin@corradi.com.br"
}
```

## Estrutura de arquivos Firebase

```
corradi-pwa/
├── firebase.json              # Config principal Firebase
├── firestore.rules            # Regras de segurança
├── firestore.indexes.json     # Índices compostos
├── functions/
│   ├── package.json           # Deps das Cloud Functions
│   ├── index.js               # Cloud Functions
│   └── .eslintrc.json
└── scripts/
    └── seed-firestore.js      # Seed inicial de dados
```

## Cloud Functions disponíveis

| Função | Tipo | Descrição |
|--------|------|-----------|
| `microdataAgent` | Callable | Agente AI para consultas em linguagem natural |
| `syncProduction` | Callable | Importa produção real do Microdata para Firestore |
| `onPlanningWrite` | Trigger | Recalcula KPIs diários ao alterar planejamento |

## Roles de usuário

| Role | Permissões |
|------|-----------|
| `viewer` | Leitura de planning e production |
| `planner` | Leitura + escrita de planning e production manual |
| `admin` | Tudo + gestão de usuários e dados de referência |
