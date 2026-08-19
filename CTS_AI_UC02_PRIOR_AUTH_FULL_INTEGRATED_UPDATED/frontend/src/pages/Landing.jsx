import { ArrowRight, ShieldCheck, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";

export default function Landing() {
  const navigate = useNavigate();
  const { setRole } = useRole();

  const start = () => {
    setRole("provider");
    navigate("/new-authorization");
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl text-center">
        <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-text-primary leading-tight">
          Intelligent
          <br />
          Prior Authorization
          <br />
          System
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-base sm:text-lg leading-8 text-text-secondary">
          Streamline healthcare authorization with AI-assisted clinical evaluation,
          <br className="hidden sm:block" /> human oversight, and seamless provider-insurer collaboration.
        </p>
        <button onClick={start} className="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover transition">
          Start Authorization <ArrowRight size={18} />
        </button>
        <div className="mt-12 flex flex-wrap justify-center gap-3 text-xs text-text-muted">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2"><Stethoscope size={14} /> Provider workflow</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2"><ShieldCheck size={14} /> Insurer oversight</span>
        </div>
      </div>
    </div>
  );
}
