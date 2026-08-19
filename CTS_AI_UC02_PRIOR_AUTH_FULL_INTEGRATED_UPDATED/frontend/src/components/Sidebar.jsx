import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  Stethoscope,
  FileText,
  History,
  Settings,
  X,
} from "lucide-react";
import { useRole } from "../context/RoleContext";

const insurerItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Policy Rules", path: "/policies", icon: FileText },
  { label: "Audit Trail", path: "/audit-trail", icon: History },
  { label: "Nurse Review", path: "/nurse-review", icon: Stethoscope },
];

const providerItems = [
  { label: "New Authorization", path: "/new-authorization", icon: PlusCircle },
  { label: "Requests", path: "/requests", icon: ClipboardList },
];

function Sidebar({ mobileOpen, onCloseMobile }) {
  const navigate = useNavigate();
  const { role } = useRole();
  const navItems = role === "provider" ? providerItems : insurerItems;

  const openSettings = () => {
    onCloseMobile?.();
    navigate("/settings");
  };

  return (
    <aside
      className={`fixed md:static top-0 left-0 z-50 h-screen w-[260px] min-w-[260px] bg-sidebar text-sidebar-text flex flex-col overflow-y-auto border-r border-sidebar-border transition-[left] duration-200 shadow-2xl md:shadow-none ${mobileOpen ? "left-0" : "-left-[280px] md:left-0"}`}
    >
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-base font-bold tracking-wide" aria-label="Go to home">
          <span className="text-primary-light text-lg">✚</span>
          <span className="text-sidebar-text">PA SYSTEM</span>
        </button>
        <button className="md:hidden text-sidebar-text-secondary hover:text-sidebar-text" onClick={onCloseMobile} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      <div className="px-5 pt-5 pb-2">
        <span className="inline-flex items-center rounded-full border border-primary-light/30 bg-primary-light/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-light">
          {role}
        </span>
      </div>

      <nav className="flex-1 flex flex-col py-3 gap-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium border-l-[3px] transition-colors duration-150 ${isActive ? "bg-sidebar-active border-primary-light text-white font-semibold shadow-sm" : "border-transparent text-sidebar-text-secondary hover:bg-sidebar-secondary hover:text-sidebar-text"}`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-5 pb-5 pt-4">
        <button onClick={openSettings} className="flex items-center gap-3 w-full text-sm font-medium text-sidebar-text-secondary hover:text-sidebar-text transition-colors py-2.5">
          <Settings size={18} />
          <span>Settings</span>
        </button>

        <div className="h-px bg-sidebar-border my-3" />

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary-light text-sidebar flex items-center justify-center text-xs font-bold shrink-0">
            {role === "provider" ? "PR" : "IN"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-sidebar-text truncate">
              {role === "provider" ? "Provider" : "Insurer"}
            </div>
            <div className="text-xs text-sidebar-text-secondary">{role === "provider" ? "Clinical Review Team" : "Authorization Team"}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
