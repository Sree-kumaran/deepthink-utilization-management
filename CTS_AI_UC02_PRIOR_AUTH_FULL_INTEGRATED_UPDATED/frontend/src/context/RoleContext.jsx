import { createContext, useContext, useMemo, useState } from "react";

const RoleContext = createContext(null);

const ROLE_STORAGE_KEY = "pa-role";

export const ROLES = {
  INSURER: "insurer",
  PROVIDER: "provider",
};

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState(
    () => localStorage.getItem(ROLE_STORAGE_KEY) || ROLES.INSURER
  );

  const setRole = (nextRole) => {
    const normalized = nextRole === ROLES.PROVIDER ? ROLES.PROVIDER : ROLES.INSURER;
    setRoleState(normalized);
    localStorage.setItem(ROLE_STORAGE_KEY, normalized);
  };

  const value = useMemo(() => ({ role, setRole, isInsurer: role === ROLES.INSURER, isProvider: role === ROLES.PROVIDER }), [role]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used inside RoleProvider");
  return context;
}
