"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  LayoutDashboard,
  Sparkles,
  ShoppingBasket,
  Truck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/internal/logout-button";

type Props = {
  userName?: string | null;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/interno", label: "Resumen", icon: LayoutDashboard },
  { href: "/interno/foco-hoy", label: "Foco de hoy", icon: Sparkles },
  { href: "/interno/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/interno/cupos", label: "Cupos", icon: CalendarDays },
  { href: "/interno/clientes", label: "Clientes", icon: UsersRound },
  { href: "/interno/proveedores", label: "Proveedores", icon: Truck },
  { href: "/interno/compras", label: "Compras", icon: ShoppingBasket },
  { href: "/interno/gastos", label: "Gastos", icon: Wallet },
  { href: "/interno/cobros", label: "Cobros", icon: Coins },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/interno") {
    return pathname === "/interno";
  }
  return pathname.startsWith(href);
}

export function AdminShell({ userName, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      setMenuOpen(!mobile);
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <div className="relative min-h-screen text-[color:var(--chocolate)]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(180deg,var(--cream-soft),var(--cream))]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-35 [background-image:radial-gradient(rgba(64,58,55,0.14)_0.85px,transparent_0.85px)] [background-size:18px_18px]"
      />

      {isMobile && menuOpen ? (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-[#262321]/12 backdrop-blur-[1px]"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed left-4 top-4 z-50 h-[calc(100vh-2rem)] w-[17.5rem] rounded-3xl border border-[color:var(--line)] bg-[color:var(--milk)]/95 p-3 shadow-[0_10px_30px_rgba(43,26,24,0.12)] backdrop-blur transition-transform duration-200 ${
          menuOpen ? "translate-x-0" : "-translate-x-[calc(100%+1.5rem)]"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Natta Gestión
              </p>
              <h1 className="truncate text-base font-semibold text-[color:var(--chocolate-deep)]">
                {userName || "Administrador"}
              </h1>
            </div>
            <button
              aria-label="Ocultar menú"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--line)] text-zinc-600 transition hover:border-[color:var(--accent)] hover:text-[color:var(--chocolate-deep)]"
              onClick={() => setMenuOpen(false)}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-4 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-sm transition ${
                    active
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-strong)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      : "border-transparent text-zinc-700 hover:border-[color:var(--line)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--chocolate-deep)]"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => {
                    if (isMobile) {
                      setMenuOpen(false);
                    }
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 border-t border-[color:var(--line)] pt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {!menuOpen ? (
        <button
          aria-label="Mostrar menú"
          className="fixed left-4 top-4 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--milk)] px-3 text-sm text-zinc-700 shadow-[0_6px_20px_rgba(38,35,33,0.09)] transition hover:border-[color:var(--accent)]"
          onClick={() => setMenuOpen(true)}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
          Menú
        </button>
      ) : null}

      <div className="px-4 py-4 md:px-6 md:py-6">
        <main
          className={`min-h-[calc(100vh-2rem)] min-w-0 space-y-8 p-1 transition-[margin] duration-200 sm:p-2 lg:p-3 ${
            menuOpen ? "lg:ml-[19rem]" : "lg:ml-0"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
