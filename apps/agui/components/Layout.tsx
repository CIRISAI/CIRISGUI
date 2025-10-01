"use client";
import LogoIcon from "../components/ui/floating/LogoIcon";
import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";
import { useAgent } from "../contexts/AgentContextHybrid";
import { useRouter } from "next/navigation";
// import AgentSelector from "./AgentSelector"; // Removed - agents require separate auth
import React, { useState, useEffect } from "react";
import {
  HoveredLink,
  Menu,
  MenuItem,
  ProductItem,
} from "../components/ui/navbar-menu";
import { cn } from "../lib/utils";
interface LayoutProps {
  children: React.ReactNode;
}

function Navbar({ className }: { className?: string }) {
  const { user, logout, hasRole } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);

  // Debug logging for role checking
  React.useEffect(() => {
    if (user) {
      console.log('🔐 User role:', user.role);
      console.log('🔐 Has ADMIN?', hasRole('ADMIN'));
      console.log('🔐 Has SYSTEM_ADMIN?', hasRole('SYSTEM_ADMIN'));
    }
  }, [user, hasRole]);

  const navigation = [{ name: "Interact", href: "/", minRole: "OBSERVER" }];
  const systemNavigation = [
    { name: "API Explorer", href: "/api-demo", minRole: "OBSERVER" },
    { name: "API Docs", href: "/docs", minRole: "OBSERVER" },
    { name: "Dashboard", href: "/dashboard", minRole: "OBSERVER" },
    { name: "Memory", href: "/memory", minRole: "OBSERVER" },
    { name: "Audit", href: "/audit", minRole: "OBSERVER" },
    { name: "Logs", href: "/logs", minRole: "OBSERVER" },
    { name: "Tools", href: "/tools", minRole: "OBSERVER" },
  ];
  const adminNavigation = [
    { name: "System", href: "/system", minRole: "ADMIN" },
    { name: "Runtime Control", href: "/runtime", minRole: "ADMIN" },
    { name: "Config", href: "/config", minRole: "ADMIN" },
    { name: "Users", href: "/users", minRole: "ADMIN" },
    { name: "WA", href: "/wa", minRole: "ADMIN" },
  ];
  const accountNavigation = [
    { name: "Account Settings", href: "/account", minRole: "OBSERVER" },
    { name: "Consent Management", href: "/account/consent", minRole: "OBSERVER" },
    { name: "Privacy Settings", href: "/account/privacy", minRole: "OBSERVER" },
  ];

  const visibleNavigation = navigation.filter((item) => hasRole(item.minRole));
  const visibleSystemNavigation = systemNavigation.filter((item) =>
    hasRole(item.minRole)
  );
  const visibleAdminNavigation = adminNavigation.filter((item) =>
    hasRole(item.minRole)
  );
  const visibleAccountNavigation = accountNavigation.filter((item) =>
    hasRole(item.minRole)
  );

  // Debug logging
  React.useEffect(() => {
    console.log('🔐 visibleAdminNavigation.length:', visibleAdminNavigation.length);
    console.log('🔐 visibleAdminNavigation:', visibleAdminNavigation);
  }, [visibleAdminNavigation]);
  return (
    <div className={cn("fixed   inset-x-0 max-w-2xl mx-auto z-50", className)}>
      <Menu setActive={setActive}>
        <Link href={"/"}>
          <LogoIcon className="h-12 w-12 text-brand-primary fill-brand-primary" />
        </Link>
        {visibleNavigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="border-transparent text-gray-900 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2  font-medium">
            {item.name}
          </Link>
        ))}
        <MenuItem setActive={setActive} active={active} item="System">
          <div className="flex flex-col space-y-4 text-sm">
            {visibleSystemNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                {item.name}
              </Link>
            ))}
          </div>
        </MenuItem>
        <MenuItem setActive={setActive} active={active} item="Account">
          <div className="flex flex-col space-y-4 text-sm">
            {visibleAccountNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                {item.name}
              </Link>
            ))}
          </div>
        </MenuItem>
        {hasRole("ADMIN") && visibleAdminNavigation.length > 0 && (
          <MenuItem setActive={setActive} active={active} item="Admin">
            <div className="flex flex-col space-y-4 text-sm">
              {visibleAdminNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  {item.name}
                </Link>
              ))}
            </div>
          </MenuItem>
        )}
        {user && (
          <div className="flex items-center space-x-4">
            {hasRole("SYSTEM_ADMIN") && (
              <button
                onClick={() => router.push("/emergency")}
                className="text-xs bg-transparent transition-all duration-300 cursor-pointer px-4 py-1 rounded-sm text-red-500 border-red-500 border hover:border-gray-700 hover:text-gray-700">
                Emergency
              </button>
            )}
          </div>
        )}
      </Menu>
    </div>
  );
}
export function Layout({ children }: LayoutProps) {
  const { user, logout, hasRole } = useAuth();
  const { currentAgent, currentAgentRole, agents } = useAgent();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar className="top-2 z-50" />
      <main className=" container pt-10 sm:px-6 lg:px-8">
        <div className=" pt-20 sm:px-6 lg:px-8">
          {user && (
            <div className="flex  items-start border border-gray-200 bg-gray-800 rounded-xl justify-between lg:shadow-lg p-6 mb-6">
              <div className="flex items-center space-x-6">
                <div>
                  <p className="textmd text-gray-200">
                    {user.username || user.user_id}
                  </p>
                  <p className="text-xs font-bold text-gray-100">({user.role})</p>
                </div>
                <div className="min-w-[250px]">
                  <p className="text-xs text-gray-400 mb-1">Current Agent:</p>
                  <div className="bg-white rounded-lg shadow-sm px-3 py-2">
                    {currentAgent ? (
                      <>
                        <p className="text-sm font-medium text-gray-900">
                          {currentAgent.agent_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {agents.length > 1 ? 'To switch agents, please logout and login again' : 'Running'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-500">
                          No agents available
                        </p>
                        <p className="text-xs text-gray-400">
                          Please create an agent using the Manager
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
