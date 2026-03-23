import { Link, useLocation } from "react-router-dom";
import { BarChart3, UserPlus, Users, TrendingUp, Sparkles } from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/add", label: "Add Student", icon: UserPlus },
  { path: "/students", label: "Students", icon: Users },
  { path: "/analysis", label: "Analysis", icon: TrendingUp },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <img src="/logo.png" className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight gradient-text">DataVista</span>
        </Link>

        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active
                  ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
