import { useEffect, useRef, useState } from "react";
import { Sun, Moon, Bell, Menu, UserCircle, ChevronDown, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useRole } from "../context/RoleContext";

export default function Header({ onToggleSidebar }) {
  const { theme, toggleTheme } = useTheme();
  const { role, setRole } = useRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const changeRole = (nextRole) => {
    setRole(nextRole);
    setOpen(false);
    navigate(nextRole === "provider" ? "/new-authorization" : "/dashboard");
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-header border-b border-border">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} aria-label="Open menu" className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-text-primary hover:bg-surface-secondary transition-colors">
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-text-primary hidden sm:block">Prior Authorization</h1>
      </div>

      <div className="flex items-center gap-2.5">
        <button aria-label="Notifications" onClick={() => navigate("/settings#notifications")} className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-bg text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors">
          <Bell size={18} />
        </button>

        <button onClick={toggleTheme} aria-label="Toggle light and dark mode" className="w-10 h-10 flex items-center justify-center rounded-lg border border-border bg-bg text-text-primary hover:bg-surface-secondary transition-colors">
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex items-center gap-1.5 w-10 h-10 justify-center rounded-lg border border-border bg-bg text-text-primary hover:bg-surface-secondary transition-colors">
            <UserCircle size={20} />
            <ChevronDown size={13} className="hidden sm:block" />
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-card z-50">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Select Role</div>
              {[
                ["insurer", "Insurer"],
                ["provider", "Provider"],
              ].map(([value, label]) => (
                <button key={value} onClick={() => changeRole(value)} className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium transition ${role === value ? "bg-primary text-white" : "text-text-primary hover:bg-surface-secondary"}`}>
                  {label}
                  {role === value && <Check size={16} />}
                </button>
              ))}
              <div className="border-t border-border" />
              <button onClick={() => { setOpen(false); navigate("/settings"); }} className="w-full px-3 py-2.5 text-left text-sm font-medium text-text-secondary hover:bg-surface-secondary">Settings</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
