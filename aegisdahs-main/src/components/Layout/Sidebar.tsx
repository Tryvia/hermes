import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Ticket, Users, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import logoHermes from "@/assets/logotipo_hermes.png";
const menuItems = [{
  icon: LayoutDashboard,
  label: "Dashboard",
  path: "/dashboard"
}, {
  icon: Ticket,
  label: "Tickets",
  path: "/tickets"
}, {
  icon: Users,
  label: "Equipes",
  path: "/teams"
}, {
  icon: Settings,
  label: "Configurações",
  path: "/settings"
}];
export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const handleLogout = async () => {
    const {
      error
    } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao fazer logout");
    } else {
      navigate("/auth");
    }
  };
  return <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <img src={logoHermes} alt="Hermes" className="h-10 w-auto" />
        <p className="text-sidebar-foreground/70 mt-2 text-base text-left mx-[29px] px-[17px] py-0 my-0">      Hermes </p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return <Link key={item.path} to={item.path} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>;
      })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>;
}