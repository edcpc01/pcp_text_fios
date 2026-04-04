# Project Handoff Context: PCP Fios (Corradi/Doptex)

This document provides a comprehensive overview of the **PCP Fios** project to facilitate a smooth handoff to Claude or any other AI assistant.

## 🚀 Project Overview
**PCP Fios** is a Progressive Web App (PWA) designed for production planning and control in textile factories (Corradi Matriz, Corradi Filial, and Doptex). It allows supervisors and planners to manage machine schedules, track actual production vs. planned goals, and monitor material stocks.

---

## 🛠 Tech Stack
- **Frontend**: React 18 (Vite), Tailwind CSS 3
- **State Management**: Zustand
- **Backend/DB**: Firebase (Firestore, Authentication, Cloud Functions)
- **Icons**: Lucide React
- **Charts**: Recharts
- **PWA**: `vite-plugin-pwa`
- **Deployment**: Vercel (Frontend), Firebase (Functions/Rules)

---

## 📁 Project Structure
- `src/`
  - `components/`: Reusable UI components (Layout, AgentPanel, FirebaseStatus, etc.)
  - `pages/`: Page-level components
    - `Dashboard.jsx`: KPI overview and charts
    - `Planning.jsx`: Matrix view for machine scheduling
    - `Production.jsx`: Actual vs. Planned comparisons
    - `Materiais.jsx`: Raw material and finished goods stock
    - `Admin.jsx`: Product and machine management
    - `Login.jsx`: Auth flow
  - `hooks/`: Store hooks (`useStore.js`) and PWA hooks
  - `services/`: Firebase initialization and data fetching (`firebase.js`)
  - `utils/`: Date helpers, seeding data, and logic
  - `styles/`: Tailwind and global CSS

---

## 🧠 Core Architecture

### 1. Centralized State (`src/hooks/useStore.js`)
The app uses several Zustand stores to manage global state:
- `useAuthStore`: User session, role, and loading state.
- `useAppStore`: Global filters (current factory, year-month visibility).
- `usePlanningStore`: Map of planning entries (`factory__machine__date`).
- `useProductionStore`: Actual production records.
- `useAdminStore`: Product catalogs and machine configurations.

### 2. Data Persistence (`src/services/firebase.js`)
All real-time subscriptions and CRUD operations are handled here. It uses:
- `onSnapshot` for real-time updates of planning, production, and products.
- `PersistentLocalCache` (Firebase 10) for offline support.
- Custom logic to auto-populate default machines if the database is empty.

---

## 🔧 Recent Critical Fixes

> [!IMPORTANT]
> The project recently faced several "Dark Screen" (blank screen) issues due to reference errors. These have been resolved:
> - **Layout Reference Error**: Fixed `isActive` being used outside of the `NavLink` function scope.
> - **Planning Reference Error**: Fixed missing imports and missing store hooks in `Planning.jsx`.
> - **Auth Robustness**: Added a 10s timeout to the loading screen in `App.jsx` to prevent the app from hanging if Firebase is slow or misconfigured.
> - **Config Safety**: Added defensive checks for `VITE_FIREBASE_API_KEY` in `firebase.js`.

---

## 🔑 Environment Variables (Vercel/Local)
The following variables are required for the app to function:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

---

## 📝 Roadmap / Pending Tasks
1. **Microdata Real Sync**: The "Agente" currently uses mock data. It needs to eventually sync with the actual Microdata ERP API via Cloud Functions.
2. **Role Refining**: Ensure "supervisor" vs "admin" permissions are strictly enforced on all buttons/actions.
3. **Multi-Factory Aggregation**: The "Todas as Unidades" view in Dashboard is functional but needs more refined reporting for material totals.

---

## 💡 Tips for Coding
- Use the **Brand tokens** defined in `tailwind.config.js` (`bg-brand-bg`, `text-brand-cyan`, etc.).
- When adding new icons, always check `lucide-react` imports.
- Maintain the **Dark Glassmorphism** aesthetic (use `glass` utility and `backdrop-blur`).
- All planning IDs must be generated using `makeEntryId(factory, machine, date)` to avoid duplicates.
