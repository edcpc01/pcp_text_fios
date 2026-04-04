# 🛡️ Implementação Frontend: Adaptações para RBAC

## Visão Geral

Com as novas regras Firestore, o frontend precisa ser adaptado para:
1. **Validar permissões localmente** (UX melhor)
2. **Preparar para erros de permissão** (graceful degradation)
3. **Controlar visibilidade de botões/funcionalidades** por role

---

## 1. Verificar Role do Usuário (useStore.js)

Adicione função helper no seu `useAuthStore`:

```javascript
// src/hooks/useStore.js

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  role: null,  // ADD: role do usuário logado
  factory: null,  // ADD: factory do usuário

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  
  // ADD: Novo método para sincronizar role e factory
  setUserRole: (role, factory) => set({ role, factory }),
  
  logout: () => set({ user: null, role: null, factory: null }),

  // ADD: Helper para verificar permissões
  hasPermission: (requiredRole) => {
    const currentRole = get().role;
    const roleHierarchy = {
      'admin': 4,
      'supervisor': 3,
      'planner': 2,
      'viewer': 1,
    };
    return (roleHierarchy[currentRole] || 0) >= (roleHierarchy[requiredRole] || 0);
  },

  // ADD: Helper para verificar fábrica
  canAccessFactory: (factory) => {
    const userFactory = get().factory;
    return factory === userFactory || factory === 'all' || userFactory === 'all';
  },
}));
```

---

## 2. Atualizar App.jsx para Sincronizar Role

Quando usuário faz login, buscar e salvar role:

```javascript
// src/App.jsx

import { useEffect } from 'react';
import { onAuthChange, getUserRole } from './services/firebase';
import { useAuthStore } from './hooks/useStore';

export default function App() {
  const { user, setUser, setUserRole } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // ADD: Buscar role e factory do usuário
        try {
          const role = await getUserRole(authUser.uid);
          // Assumindo que getUserRole retorna { role, factory }
          const userData = await getUserData(authUser.uid);
          setUserRole(userData.role, userData.factory);
        } catch (err) {
          console.warn('Erro ao buscar role:', err);
          setUserRole('viewer', 'matriz');  // Default: viewer, matrix
        }
      } else {
        setUserRole(null, null);
      }
    });

    return unsubscribe;
  }, []);

  // ... resto do App
}
```

**Função auxiliar para buscar user data:**

```javascript
// src/services/firebase.js

export async function getUserData(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        role: data.role || 'planner',
        factory: data.factory || 'matriz',
        name: data.name || '',
        email: data.email || '',
      };
    }
    return { role: 'planner', factory: 'matriz' };
  } catch (err) {
    console.error('getUserData failed:', err);
    return { role: 'planner', factory: 'matriz' };
  }
}
```

---

## 3. Componente de Permissões (Utils)

Crie um componente helper para checar permissões:

```javascript
// src/components/PermissionGate.jsx

import { useAuthStore } from '../hooks/useStore';

export function PermissionGate({ requiredRole, children, fallback = null }) {
  const { hasPermission } = useAuthStore();

  return hasPermission(requiredRole) ? children : fallback;
}

// Uso:
// <PermissionGate requiredRole="supervisor">
//   <button>Editar</button>
// </PermissionGate>
```

---

## 4. Atualizar Planning.jsx (Controle de Edição)

```javascript
// src/pages/Planning.jsx

import { PermissionGate } from '../components/PermissionGate';

export default function Planning() {
  const { role, factory } = useAuthStore();
  const isEditable = role !== 'viewer';  // Viewers não podem editar

  return (
    <div>
      <h1>Planejamento de Produção</h1>

      {/* Mostrar badge com role do usuário */}
      <div className="mb-4">
        <span className="badge">{role.toUpperCase()}</span>
        <span className="text-sm text-gray-400 ml-2">({factory})</span>
      </div>

      {/* Botão "Adicionar Entrada" — bloqueado para viewers */}
      <PermissionGate requiredRole="supervisor">
        <button onClick={openEntryModal} className="btn-primary">
          + Adicionar Entrada
        </button>
      </PermissionGate>

      {/* Grid de planejamento — sempre visível, mas células readonly se viewer */}
      <PlanningGrid
        entries={entries}
        editable={isEditable}
        onSave={savePlanningEntry}
        onDelete={deletePlanningEntry}
      />
    </div>
  );
}
```

---

## 5. Tratamento de Erros de Permissão

Adicione erro handler global para "Permission denied":

```javascript
// src/services/firebase.js

async function withErrorHandling(operation, operationName) {
  try {
    return await operation();
  } catch (err) {
    if (err.code === 'permission-denied') {
      console.error(`${operationName} bloqueado: Sem permissão`);
      // Mostrar toast/alert ao usuário
      showErrorToast(`Sem permissão para ${operationName}`);
      throw new Error(`Permission denied: ${operationName}`);
    }
    throw err;
  }
}

// Usar assim:
export async function savePlanningEntry(entry) {
  return withErrorHandling(
    () => savePlanningEntryImpl(entry),
    'salvar planejamento'
  );
}
```

---

## 6. Admin Panel — Restringir a Admin

```javascript
// src/pages/Admin.jsx

import { useAuthStore } from '../hooks/useStore';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Admin() {
  const { role } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirecionar se não for admin
    if (role !== 'admin') {
      navigate('/');
      return;
    }
  }, [role]);

  if (role !== 'admin') {
    return <div>Acesso negado</div>;
  }

  return (
    <div>
      <h1>Painel de Administração</h1>
      {/* Conteúdo admin */}
    </div>
  );
}
```

---

## 7. Agente AI — Restringir Acesso

```javascript
// src/components/AgentPanel.jsx

import { PermissionGate } from './PermissionGate';
import { useAuthStore } from '../hooks/useStore';

export default function AgentPanel() {
  const { agentOpen, setAgentOpen } = useAppStore();
  const { role, factory } = useAuthStore();

  return (
    <PermissionGate requiredRole="planner">
      {agentOpen && (
        <div className="agent-panel">
          <div className="agent-info">
            <p className="text-xs text-gray-400">
              Usuário: {role} | Fábrica: {factory}
            </p>
          </div>
          {/* Chat interface */}
        </div>
      )}
    </PermissionGate>
  );
}
```

---

## 8. Badge/Status do Usuário (Layout.jsx)

```javascript
// src/components/Layout.jsx

import { useAuthStore } from '../hooks/useStore';

function UserStatus() {
  const { user, role, factory } = useAuthStore();

  if (!user) return null;

  const roleBadgeColor = {
    'admin': 'bg-red-600',
    'supervisor': 'bg-blue-600',
    'planner': 'bg-green-600',
    'viewer': 'bg-gray-600',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded text-xs font-bold text-white ${roleBadgeColor[role]}`}>
        {role.toUpperCase()}
      </span>
      <span className="text-sm text-gray-400">
        {user.email}
      </span>
      <span className="text-xs text-gray-500">
        ({factory})
      </span>
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <div className="layout">
      <header className="navbar">
        <div className="navbar-end">
          <UserStatus />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

---

## 9. Matriz de Visibilidade por Role

```javascript
// src/utils/permissions.js

export const PAGE_PERMISSIONS = {
  '/dashboard': ['admin', 'supervisor', 'planner', 'viewer'],
  '/planning': ['admin', 'supervisor', 'planner', 'viewer'],
  '/production': ['admin', 'supervisor', 'planner', 'viewer'],
  '/materials': ['admin', 'supervisor', 'planner', 'viewer'],
  '/admin': ['admin'],  // Apenas admin
  '/agent': ['admin', 'supervisor', 'planner'],  // Sem viewer
};

export const ACTION_PERMISSIONS = {
  'create_planning': ['admin', 'supervisor', 'planner'],
  'edit_planning': ['admin', 'supervisor', 'planner'],
  'delete_planning': ['admin', 'supervisor'],
  'edit_product': ['admin'],
  'edit_machine': ['admin'],
  'update_stock': ['admin', 'supervisor'],
  'view_logs': ['admin', 'supervisor'],
};

// Usar:
function canPerformAction(role, action) {
  return ACTION_PERMISSIONS[action]?.includes(role) || false;
}
```

---

## 10. Mensagens de Erro User-Friendly

```javascript
// src/utils/errors.js

export const ERROR_MESSAGES = {
  'permission-denied': 'Você não tem permissão para realizar essa ação.',
  'unauthenticated': 'Faça login para continuar.',
  'not-found': 'Dados não encontrados.',
  'invalid-data': 'Dados inválidos. Verifique e tente novamente.',
  'network-error': 'Erro de conexão. Verifique sua internet.',
};

// Usar em error handlers:
try {
  await savePlanningEntry(entry);
} catch (err) {
  const message = ERROR_MESSAGES[err.code] || err.message;
  showErrorToast(message);
}
```

---

## Exemplo: Fluxo Completo de Verificação

```javascript
// Usuário tenta criar planejamento
async function handleCreatePlanning(entry) {
  const { role, canAccessFactory } = useAuthStore();

  // 1. Verificar role
  if (!['admin', 'supervisor', 'planner'].includes(role)) {
    showErrorToast('Apenas planejadores podem criar entradas');
    return;
  }

  // 2. Verificar fábrica
  if (!canAccessFactory(entry.factory)) {
    showErrorToast(`Você não tem acesso à fábrica ${entry.factory}`);
    return;
  }

  // 3. Tentar salvar (Firestore vai validar novamente)
  try {
    await savePlanningEntry(entry);
    showSuccessToast('Planejamento criado');
  } catch (err) {
    if (err.code === 'permission-denied') {
      // Firebase bloqueou — usar usuário diferente ou verificar permissão
      showErrorToast('Permissão bloqueada pelo servidor');
    } else {
      showErrorToast(err.message);
    }
  }
}
```

---

## 🚀 Checklist de Implementação

- [ ] Adicionar `role` e `factory` a `useAuthStore`
- [ ] Implementar `hasPermission()` e `canAccessFactory()`
- [ ] Criar `PermissionGate` component
- [ ] Atualizar `App.jsx` para sincronizar role após login
- [ ] Adicionar `getUserData()` a `src/services/firebase.js`
- [ ] Restringir visibilidade de botões por role
- [ ] Restringir acesso a `/admin` página
- [ ] Adicionar tratamento de erro "permission-denied"
- [ ] Testar com usuários de diferentes roles
- [ ] Adicionar badges visuais mostrando role atual

---

## Testes Recomendados

### Teste 1: Viewer tenta editar
```
1. Login como viewer
2. Navegar para Planning
3. Tentar clicar "Adicionar Entrada"
   → Esperado: Botão desabilitado ou oculto
4. Se conseguir clicar, enviar ao Firestore
   → Esperado: "Permission denied" error
```

### Teste 2: Planner não acessa Admin
```
1. Login como planner
2. Tentar acessar /admin
   → Esperado: Redirecionar para /
```

### Teste 3: Supervisor atualiza estoque
```
1. Login como supervisor
2. Ir para Materiais
3. Editar quantidade de estoque
   → Esperado: Sucesso
4. Logout como supervisor, login como viewer
5. Tentar editar mesmo estoque
   → Esperado: "Permission denied"
```

---

**Próximo passo:** Implementar essas mudanças no seu código, testar e fazer commit!
