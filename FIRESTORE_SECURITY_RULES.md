# 🔐 Firestore Security Rules — RBAC Implementation

## Visão Geral

As regras de segurança do Firestore foram refinadas para implementar **Role-Based Access Control (RBAC)** granular, substituindo a configuração anterior que permitia acesso irrestrito a qualquer usuário autenticado.

---

## 📋 Estrutura de Roles

| Role | Permissões | Uso |
|------|-----------|-----|
| **admin** | Acesso total (CRUD em todas as coleções) | Administradores do sistema |
| **supervisor** | Leitura de todos os dados, escrita em planejamento/produção/estoque | Supervisores de fábrica |
| **planner** | Leitura de todos os dados, escrita em planejamento | Planejadores |
| **viewer** | Leitura apenas (sem escrita) | Consultores, auditores |

---

## 🔑 Funções Auxiliares

```javascript
isAuth()                // Usuário está autenticado?
getUserRole()           // Obtém role do usuário a partir de /users/{uid}
getUserFactory()        // Obtém fábrica do usuário (matriz, filial, all)
isAdmin()              // Role == 'admin'?
isSupervisor()         // Role in ['admin', 'supervisor']?
isPlanner()            // Role in ['admin', 'supervisor', 'planner']?
isViewer()             // Role in ['admin', 'supervisor', 'planner', 'viewer']?
canAccessFactory()     // Usuário pode acessar a fábrica ou 'all'?
```

---

## 📁 Regras por Coleção

### 1. **`/users` — Perfis de Usuário**
```
READ:   Usuários leem seu próprio perfil + admin lê todos
WRITE:  Apenas admin pode criar/atualizar roles
CREATE: Usuários podem criar seu próprio perfil na primeira login (default: planner)
```
**Notas:**
- Cada usuário tem `role` e `factory` no documento
- `factory` pode ser `'matriz'`, `'filial'` ou `'all'` (multi-fábrica)
- Campos: `{ role: string, factory: string, name: string, email: string, createdAt: timestamp }`

---

### 2. **`/planning_entries` — Matriz de Planejamento**
```
READ:   Planejadores+ conseguem ler planejamento de sua fábrica
CREATE: Supervisores+ criam entradas (validando factory, machine, date)
UPDATE: Supervisores+ atualizam entradas de sua fábrica
DELETE: Supervisores+ deletam entradas de sua fábrica
```
**Validações:**
- Usuário deve ter acesso à fábrica do documento
- `factory`, `machine`, `date` são obrigatórios

---

### 3. **`/production_records` — Dados de Produção Real**
```
READ:   Planejadores+ leem registros de sua fábrica
CREATE: Supervisores+ criam (tipicamente via Cloud Function/Microdata)
UPDATE: Supervisores+ atualizam
DELETE: Apenas admin deleta
```
**Notas:**
- Cloud Functions escrevem com service account (bypass de regras)
- Supervisores podem corrigir erros
- Auditoria: mantém histórico (soft delete se necessário)

---

### 4. **`/products` — Catálogo de Produtos**
```
READ:   Todos os usuários autenticados (necessário para planejamento)
WRITE:  Apenas admin (dados mestres)
DELETE: Apenas admin
```
**Campos:**
- `id`, `descricao`, `codigoMicrodata`, `composicao`, `prodDiaPosicao`, etc.

---

### 5. **`/machines_config` — Configuração de Máquinas**
```
READ:   Todos os usuários autenticados (necessário para grids)
WRITE:  Apenas admin
DELETE: Apenas admin
```
**Campos:**
- `factory`, `machineId`, `spindles`, `efficiency`, `updatedAt`

---

### 6. **`/raw_material_stock` — Estoque de Matérias-Primas**
```
READ:   Planejadores+
CREATE: Supervisores+
UPDATE: Supervisores+ (alterar quantidades)
DELETE: Apenas admin
```
**Notas:**
- Supervisores atualizam necessidade vs. estoque
- Viewers só leem (read-only)

---

### 7. **`/finished_goods_stock` — Estoque de Produtos Acabados**
```
READ:   Planejadores+
CREATE: Supervisores+
UPDATE: Supervisores+
DELETE: Apenas admin
```

---

### 8. **`/agent_logs` — Histórico do Agente AI**
```
READ:   Usuários leem seus próprios logs; admin lê todos
CREATE: Usuários criam logs com seu UID
UPDATE: Apenas admin
DELETE: Apenas admin
```
**Notas:**
- `userId` deve corresponder ao `request.auth.uid`

---

### 9. **`/kpi_summaries` — KPIs Agregados (Cloud Function)**
```
READ:   Planejadores+ leem KPIs de sua fábrica
WRITE:  Apenas Cloud Function (service account)
DELETE: Apenas admin
```
**Notas:**
- Cloud Functions escrevem com service account, que bypassa regras
- Usuários só conseguem ler (visão computada)

---

## 🚀 Padrão Multi-Fábrica

```javascript
// Usuário pode acessar dados de sua fábrica OU 'all' (agregado)
canAccessFactory(factory) {
  let userFactory = getUserFactory();
  return factory == userFactory || factory == 'all' || userFactory == 'all';
}
```

**Exemplo:**
- Usuário atribuído a `'matriz'` → pode ler `matrix` planejamento, mas NÃO `filial`
- Usuário atribuído a `'all'` → pode ler AMBAS as fábricas
- Admin (role) pode ler qualquer dados de qualquer fábrica

---

## 🔒 Segurança por Design

### ✅ **O que está protegido:**
1. **Dados mestres** (produtos, máquinas): Apenas admin pode modificar
2. **Planejamento**: Supervisores podem editar, viewers veem apenas leitura
3. **Produção**: Supervisores atualizam, viewers veem apenas
4. **Estoque**: Supervisores alteram quantidades, viewers monitoram
5. **Permissões por fábrica**: Usuários de matriz não veem filial (e vice-versa)
6. **Logs do agent**: Usuários veem seus próprios, admin vê tudo

### ⚠️ **Exceções (Service Accounts):**
- Cloud Functions com service account bypassa todas as regras (para integrações Microdata)
- Isso é intencional para automation

---

## 📊 Matriz de Permissões

| Ação | Admin | Supervisor | Planner | Viewer |
|------|-------|------------|---------|--------|
| Ler Planejamento | ✅ | ✅ | ✅ | ✅ |
| Criar Planejamento | ✅ | ✅ | ✅ | ❌ |
| Editar Planejamento | ✅ | ✅ | ✅ | ❌ |
| Deletar Planejamento | ✅ | ✅ | ❌ | ❌ |
| Ler Produção | ✅ | ✅ | ✅ | ✅ |
| Corrigir Produção | ✅ | ✅ | ❌ | ❌ |
| Gerenciar Produtos | ✅ | ❌ | ❌ | ❌ |
| Editar Máquinas | ✅ | ❌ | ❌ | ❌ |
| Atualizar Estoque | ✅ | ✅ | ❌ | ❌ |
| Ver KPIs | ✅ | ✅ | ✅ | ✅ |
| Gerenciar Usuários | ✅ | ❌ | ❌ | ❌ |

---

## 🛠️ Como Atribuir Roles

### Opção 1: Via Firebase Console (Manual)

1. **Firestore Database** → Coleção `users`
2. Adicione um documento com ID = `{uid}` do usuário
3. Campos:
   ```json
   {
     "role": "planner",
     "factory": "matriz",
     "name": "João Silva",
     "email": "joao@corradi.com.br",
     "createdAt": timestamp
   }
   ```

### Opção 2: Via Cloud Function (Programático)

```javascript
const admin = require('firebase-admin');

exports.assignUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not logged in');
  if (context.auth.customClaims?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Not an admin');
  }

  const { uid, role, factory } = data;
  
  await admin.firestore().collection('users').doc(uid).set({
    role,
    factory,
    updatedAt: admin.firestore.Timestamp.now(),
  }, { merge: true });

  return { success: true };
});
```

### Opção 3: Criar usuário na primeira login

O código já faz isso automaticamente:
```javascript
// src/services/firebase.js - getUserRole()
await setDoc(doc(db, 'users', uid), { 
  role: 'planner',  // Default role
  createdAt: Timestamp.now() 
}, { merge: true });
```

---

## 🚨 Comportamentos Esperados

### ✅ **Planeja está planejando**
```javascript
// Usuario.role = 'planner', factory = 'matriz'
// Consegue:
- Ler planejamento de matriz ✅
- Ler planejamento de filial ❌ (factory mismatch)
- Criar entrada de planejamento ✅
- Editar entrada de planejamento ✅
- Deletar entrada ❌ (só supervisor+ podem)
```

### ✅ **Supervisor revisa produção**
```javascript
// Usuario.role = 'supervisor', factory = 'all'
// Consegue:
- Ler matriz ✅
- Ler filial ✅
- Corrigir registro de produção ✅
- Gerenciar estoque ✅
- Deletar planejamento ✅
```

### ✅ **Admin gerencia sistema**
```javascript
// Usuario.role = 'admin' (factory não importa)
// Consegue:
- Acessar TODOS os dados ✅
- Editar produtos ✅
- Atribuir roles a usuários ✅
- Deletar qualquer documento ✅
```

### ❌ **Viewer tenta editar (bloqueado)**
```javascript
// Usuario.role = 'viewer'
// Tenta:
- Criar planejamento → **Permission denied** ❌
- Editar estoque → **Permission denied** ❌
- Ler KPIs → OK ✅
```

---

## 🚀 Implantação

### Passo 1: Fazer Deploy das Regras

**Via Firebase Console:**
1. **Firestore Database** → aba **"Regras"**
2. Cole o conteúdo do arquivo `firestore.rules` atualizado
3. Clique em **"Publicar"**

**Via CLI (se tiver Node instalado):**
```bash
firebase deploy --only firestore:rules
```

**Via GitHub Actions (recomendado):**
O workflow `.github/workflows/firebase-deploy.yml` já faz isso automaticamente:
```bash
firebase deploy --only functions,firestore:rules,firestore:indexes
```

### Passo 2: Criar Usuários Admin e Atribuir Roles

No Firebase Console:

1. **Authentication** → **Users** → **Add User**
   - Email: `admin@corradi.com.br`
   - Senha: (secura forte)

2. **Firestore** → **Coleção `users`** → **Novo documento**
   - ID: (copiar UID do usuário criado acima)
   - Campos:
     ```json
     {
       "role": "admin",
       "factory": "all",
       "name": "Administrador",
       "email": "admin@corradi.com.br",
       "createdAt": timestamp
     }
     ```

3. Repetir para supervisores/planejadores com roles apropriados

### Passo 3: Testar Acesso

- Fazer login como `viewer` → tentar editar planejamento → erro "Permission denied" ✅
- Fazer login como `planner` → criar entrada → sucesso ✅
- Fazer login como `admin` → editar produto → sucesso ✅

---

## ⚠️ Notas Importantes

### 1. **Factory é Obrigatório**
Todos os documentos que precisam de controle por fábrica devem ter campo `factory`:
```javascript
{
  factory: "matriz",  // ou "filial" ou "all"
  ...
}
```

### 2. **Cloud Functions Usam Service Account**
```javascript
// Regra: allow create, update: if false;
// MAS: Cloud Functions com service account bypassa regra
// Isso é intencional para dados sinced do Microdata
```

### 3. **Índices Recomendados**
Adicione se quiser otimizar queries por factory:
```javascript
// Firestore Composite Indexes:
1. planning_entries: (factory ASC, date ASC)
2. production_records: (factory ASC, date ASC)
3. raw_material_stock: (factory ASC) — se houver campo factory
```

### 4. **Cache Local Funciona Mesmo com Rules**
- App offline → usa cache persistente
- Quando online → queries validam rules
- Escritas offline são silenciosas; são validadas ao reconnect

### 5. **Debugging**
Se usuário receber "Permission denied":
1. Verificar se documento `users/{uid}` existe
2. Verificar se `role` está correto
3. Verificar se `factory` do usuário bate com `factory` do documento acessado
4. Ver **Firestore Rules Simulator** no Console

---

## 📝 Exemplo: Adicionar Novo Role

Se precisar de um novo role (ex: `auditor`):

1. Edite `firestore.rules`:
```javascript
function isAuditor() {
  return isAuth() && getUserRole() in ['admin', 'auditor'];
}
```

2. Use em uma regra:
```javascript
match /reports/{reportId} {
  allow read: if isAuditor();  // Auditor pode ler relatórios
  allow write: if isAdmin();
}
```

3. Redeploy:
```bash
firebase deploy --only firestore:rules
```

---

## 🔗 Referências

- [Firestore Security Rules Docs](https://firebase.google.com/docs/firestore/security/start)
- [RBAC Pattern](https://firebase.google.com/docs/firestore/manage-data/enable-access-based-on-user-attributes)
- [Rules Simulator](https://firebase.google.com/docs/firestore/security/test-rules-simulator)

---

## ✅ Checklist pós-deployment

- [ ] Regras publicadas com sucesso no Console
- [ ] Admin user criado com role='admin'
- [ ] Supervisor user criado com role='supervisor'
- [ ] Planner user criado com role='planner'
- [ ] Testes de leitura/escrita por role executados
- [ ] Viewer testou e recebeu "Permission denied" ao tentar criar ✅
- [ ] App continua funcionando (sem quebras)
- [ ] Documentação compartilhada com equipe

---

**Última atualização:** 2026-04-03
**Status:** Pronto para produção ✅
