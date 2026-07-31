"use client";

import Link from "next/link";
import { MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type RouteWarmupPlan = {
  immediate: string[];
  extended: string[];
};

type ScheduledTask =
  | {
      handle: number;
      kind: "idle";
    }
  | {
      handle: number;
      kind: "timeout";
    };

const FEED_PATH = "/dashboard/feed";
const INVENTORY_PATH = "/dashboard/inventory";
const CLIENT_APP_PATH = "/dashboard/client-app";
const FINANCE_PATH = "/dashboard/finance";
const CAMPAIGNS_PATH = "/dashboard/benefits/promotions";
const SETTINGS_PATH = "/dashboard/settings";

const primaryNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Hoje",
    description: "Resumo do dia",
    icon: "home",
  },
  {
    href: MANAGEMENT_ROUTES.appointments,
    label: "Agenda",
    description: "Horários do dia",
    icon: "calendar",
  },
  {
    href: MANAGEMENT_ROUTES.clients,
    label: "Clientes",
    description: "Cadastro e retorno",
    icon: "users",
  },
  {
    href: MANAGEMENT_ROUTES.services,
    label: "Serviços",
    description: "Catálogo do salão",
    icon: "sparkles",
  },
  {
    href: MANAGEMENT_ROUTES.professionals,
    label: "Equipe",
    description: "Profissionais e agenda",
    icon: "team",
  },
  {
    href: FINANCE_PATH,
    label: "Caixa",
    description: "Receita e comandas",
    icon: "wallet",
  },
  {
    href: FEED_PATH,
    label: "Feed",
    description: "Posts e stories",
    icon: "gallery",
  },
  {
    href: INVENTORY_PATH,
    label: "Loja",
    description: "Produtos e pedidos",
    icon: "box",
  },
];

const extraNavGroups: NavGroup[] = [
  {
    label: "Cliente",
    items: [
      {
        href: CAMPAIGNS_PATH,
        label: "Campanhas",
        description: "Ofertas e retorno",
        icon: "bolt",
      },
      {
        href: CLIENT_APP_PATH,
        label: "App do cliente",
        description: "Vitrine e atalhos",
        icon: "phone",
      },
    ],
  },
  {
    label: "Painel",
    items: [
      {
        href: SETTINGS_PATH,
        label: "Ajustes",
        description: "Marca e regras",
        icon: "gear",
      },
    ],
  },
];

const extraNav = extraNavGroups.flatMap((group) => group.items);

const dashboardNavGroups: NavGroup[] = [
  {
    label: "Dia a dia",
    items: [
      primaryNav[0]!,
      primaryNav[1]!,
      primaryNav[5]!,
    ],
  },
  {
    label: "Clientes e vendas",
    items: [
      primaryNav[2]!,
      primaryNav[6]!,
      primaryNav[7]!,
      extraNavGroups[0]!.items[0]!,
      extraNavGroups[0]!.items[1]!,
    ],
  },
  {
    label: "Estrutura",
    items: [
      primaryNav[3]!,
      primaryNav[4]!,
      extraNavGroups[1]!.items[0]!,
    ],
  },
];

const dashboardNav = dashboardNavGroups.flatMap((group) => group.items);
const lockedWorkspaceNav: NavItem[] = [
  {
    href: "/planos",
    label: "Escolher plano",
    description: "Ativação comercial",
    icon: "wallet",
  },
];

function buildRouteWarmupPlan(
  pathname: string,
  isWorkspaceLocked: boolean,
): RouteWarmupPlan {
  if (isWorkspaceLocked) {
    return {
      immediate: ["/planos"],
      extended: [],
    };
  }

  if (
    pathname.startsWith("/dashboard/gestao") ||
    pathname.startsWith("/dashboard/services") ||
    pathname.startsWith("/dashboard/team")
  ) {
    return {
      immediate: [
        "/dashboard",
        MANAGEMENT_ROUTES.appointments,
        MANAGEMENT_ROUTES.clients,
        FINANCE_PATH,
      ],
      extended: [
        MANAGEMENT_ROUTES.services,
        MANAGEMENT_ROUTES.professionals,
        INVENTORY_PATH,
        FEED_PATH,
        CAMPAIGNS_PATH,
      ],
    };
  }

  if (pathname.startsWith("/dashboard/benefits")) {
    return {
      immediate: [
        "/dashboard",
        CAMPAIGNS_PATH,
        FEED_PATH,
        INVENTORY_PATH,
      ],
      extended: [
        MANAGEMENT_ROUTES.clients,
        MANAGEMENT_ROUTES.appointments,
        FINANCE_PATH,
        CLIENT_APP_PATH,
      ],
    };
  }

  if (pathname.startsWith(FINANCE_PATH)) {
    return {
      immediate: [
        "/dashboard",
        MANAGEMENT_ROUTES.appointments,
        MANAGEMENT_ROUTES.clients,
        INVENTORY_PATH,
      ],
      extended: [
        MANAGEMENT_ROUTES.services,
        MANAGEMENT_ROUTES.professionals,
        FEED_PATH,
        CAMPAIGNS_PATH,
      ],
    };
  }

  if (pathname.startsWith(SETTINGS_PATH)) {
    return {
      immediate: [
        "/dashboard",
        MANAGEMENT_ROUTES.appointments,
        MANAGEMENT_ROUTES.clients,
        FINANCE_PATH,
      ],
      extended: [FEED_PATH, INVENTORY_PATH, CLIENT_APP_PATH, CAMPAIGNS_PATH],
    };
  }

  if (
    pathname.startsWith(CLIENT_APP_PATH) ||
    pathname.startsWith("/dashboard/notifications") ||
    pathname.startsWith(FEED_PATH) ||
    pathname.startsWith("/dashboard/birthdays") ||
    pathname.startsWith(INVENTORY_PATH) ||
    pathname.startsWith("/dashboard/operations") ||
    pathname.startsWith("/dashboard/subscriptions") ||
    pathname.startsWith("/dashboard/billing") ||
    pathname.startsWith("/dashboard/ai")
  ) {
    return {
      immediate: [
        "/dashboard",
        FEED_PATH,
        INVENTORY_PATH,
        MANAGEMENT_ROUTES.clients,
      ],
      extended: [
        MANAGEMENT_ROUTES.appointments,
        MANAGEMENT_ROUTES.services,
        MANAGEMENT_ROUTES.professionals,
        FINANCE_PATH,
        CAMPAIGNS_PATH,
      ],
    };
  }

  return {
    immediate: [
      MANAGEMENT_ROUTES.appointments,
      MANAGEMENT_ROUTES.clients,
      MANAGEMENT_ROUTES.services,
      FINANCE_PATH,
    ],
    extended: [
      MANAGEMENT_ROUTES.professionals,
      FEED_PATH,
      INVENTORY_PATH,
      CAMPAIGNS_PATH,
      CLIENT_APP_PATH,
    ],
  };
}

function dedupeWarmupRoutes(pathname: string, routes: string[]) {
  return routes.filter((href, index, collection) => {
    return href !== pathname && collection.indexOf(href) === index;
  });
}

function shouldRunExtendedWarmup() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const connection = (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string | null;
        saveData?: boolean;
      };
    }
  ).connection;

  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  const effectiveType = connection.effectiveType?.toLowerCase();
  return effectiveType !== "slow-2g" && effectiveType !== "2g";
}

function scheduleWarmupTask(callback: () => void, timeout: number): ScheduledTask {
  const supportsIdleCallback =
    typeof window.requestIdleCallback === "function" &&
    typeof window.cancelIdleCallback === "function";

  if (supportsIdleCallback) {
    return {
      handle: window.requestIdleCallback(() => callback(), { timeout }),
      kind: "idle",
    };
  }

  return {
    handle: window.setTimeout(callback, Math.min(timeout, 700)),
    kind: "timeout",
  };
}

function cancelWarmupTask(task: ScheduledTask | null) {
  if (!task) {
    return;
  }

  if (task.kind === "idle") {
    window.cancelIdleCallback(task.handle);
    return;
  }

  window.clearTimeout(task.handle);
}

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 3.75a.75.75 0 0 1 .75.75V6h8.5V4.5a.75.75 0 0 1 1.5 0V6h.25A2.75 2.75 0 0 1 20.75 8.75v9.5A2.75 2.75 0 0 1 18 21H6a2.75 2.75 0 0 1-2.75-2.75v-9.5A2.75 2.75 0 0 1 6 6h.25V4.5A.75.75 0 0 1 7 3.75Zm11 7.75h-12v6.75c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V11.5Zm-10.75-4A1.25 1.25 0 0 0 6 8.75V10h12V8.75c0-.69-.56-1.25-1.25-1.25H7.25Z"
            fill="currentColor"
          />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9.5 6.25a3.25 3.25 0 1 1 0 6.5a3.25 3.25 0 0 1 0-6.5Zm0 1.5a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 0 0 0-3.5Zm7.25.5a2.5 2.5 0 1 1 0 5a.75.75 0 0 1 0-1.5a1 1 0 1 0 0-2a.75.75 0 0 1 0-1.5ZM3.75 18A4.75 4.75 0 0 1 8.5 13.25h2A4.75 4.75 0 0 1 15.25 18a.75.75 0 0 1-1.5 0a3.25 3.25 0 0 0-3.25-3.25h-2A3.25 3.25 0 0 0 5.25 18a.75.75 0 0 1-1.5 0Zm11-.5a.75.75 0 0 1 .75-.75h.5A3.25 3.25 0 0 1 19.25 20a.75.75 0 0 1-1.5 0a1.75 1.75 0 0 0-1.75-1.75h-.5a.75.75 0 0 1-.75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.23 4.54c.28-1.06 1.8-1.06 2.08 0l.46 1.74a1.5 1.5 0 0 0 1.06 1.06l1.74.46c1.06.28 1.06 1.8 0 2.08l-1.74.46a1.5 1.5 0 0 0-1.06 1.06l-.46 1.74c-.28 1.06-1.8 1.06-2.08 0l-.46-1.74a1.5 1.5 0 0 0-1.06-1.06l-1.74-.46c-1.06-.28-1.06-1.8 0-2.08l1.74-.46a1.5 1.5 0 0 0 1.06-1.06l.46-1.74Zm6.72 9.72c.18-.68 1.15-.68 1.33 0l.22.83c.12.43.45.76.88.88l.83.22c.68.18.68 1.15 0 1.33l-.83.22a1.25 1.25 0 0 0-.88.88l-.22.83c-.18.68-1.15.68-1.33 0l-.22-.83a1.25 1.25 0 0 0-.88-.88l-.83-.22c-.68-.18-.68-1.15 0-1.33l.83-.22c.43-.12.76-.45.88-.88l.22-.83Zm-9.9 2.36c.21-.8 1.35-.8 1.56 0l.29 1.08c.14.54.56.96 1.1 1.1l1.08.29c.8.21.8 1.35 0 1.56l-1.08.29c-.54.14-.96.56-1.1 1.1l-.29 1.08c-.21.8-1.35.8-1.56 0l-.29-1.08a1.56 1.56 0 0 0-1.1-1.1l-1.08-.29c-.8-.21-.8-1.35 0-1.56l1.08-.29c.54-.14.96-.56 1.1-1.1l.29-1.08Z"
            fill="currentColor"
          />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 19.2 5.8 13a4 4 0 0 1 5.6-5.7L12 8l.6-.7a4 4 0 0 1 5.6 5.7L12 19.2Z"
            fill="currentColor"
          />
        </svg>
      );
    case "team":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7.75 6.5a2.75 2.75 0 1 1 5.5 0a2.75 2.75 0 0 1-5.5 0Zm2.75-1.25a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5Zm5.75 2A2.25 2.25 0 1 1 18.5 9.5a.75.75 0 0 1 0-1.5a.75.75 0 1 0-.75-.75a.75.75 0 0 1-1.5 0ZM4.25 16.5A3.25 3.25 0 0 1 7.5 13.25h6A3.25 3.25 0 0 1 16.75 16.5a.75.75 0 0 1-1.5 0a1.75 1.75 0 0 0-1.75-1.75h-6A1.75 1.75 0 0 0 5.75 16.5a.75.75 0 0 1-1.5 0Zm11 .5a.75.75 0 0 1 .75-.75h.5a2.75 2.75 0 0 1 2.75 2.75a.75.75 0 0 1-1.5 0a1.25 1.25 0 0 0-1.25-1.25H16a.75.75 0 0 1-.75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 4.25a.75.75 0 0 1 .75.75v13.25H19a.75.75 0 0 1 0 1.5H5A.75.75 0 0 1 4.25 19V5A.75.75 0 0 1 5 4.25Zm4.25 7a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm4-4a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75Zm4 2.5A.75.75 0 0 1 18 10.5V18a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12.76 3.5a.75.75 0 0 1 .67 1.1L10.96 9h4.79a.75.75 0 0 1 .56 1.25l-6.5 7.25a.75.75 0 0 1-1.26-.77L10.73 12H6.25a.75.75 0 0 1-.62-1.17l6.5-7a.75.75 0 0 1 .63-.33Z"
            fill="currentColor"
          />
        </svg>
      );
    case "receipt":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 4.25a.75.75 0 0 0-.75.75v14.19a.25.25 0 0 0 .4.2l1.84-1.38a.75.75 0 0 1 .88 0l1.84 1.38a.75.75 0 0 0 .88 0l1.84-1.38a.75.75 0 0 1 .88 0l1.84 1.38a.25.25 0 0 0 .4-.2V5A.75.75 0 0 0 17 4.25H7Zm0-1.5h10A2.25 2.25 0 0 1 19.25 5v14.19c0 1-.87 1.56-1.7 1.56c-.35 0-.7-.1-1-.32l-1.35-1.01l-1.35 1.02c-.6.45-1.4.45-2 0l-1.35-1.02l-1.35 1.02c-.3.22-.65.32-1 .32c-.83 0-1.7-.56-1.7-1.56V5A2.25 2.25 0 0 1 7 2.75Zm2.75 4a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 3.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 3.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "gallery":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 4.25h12A1.75 1.75 0 0 1 19.75 6v12A1.75 1.75 0 0 1 18 19.75H6A1.75 1.75 0 0 1 4.25 18V6A1.75 1.75 0 0 1 6 4.25Zm0 1.5a.25.25 0 0 0-.25.25v8.2l3.12-3.12a1.75 1.75 0 0 1 2.47 0l1.3 1.3l2.3-2.3a1.75 1.75 0 0 1 2.47 0l.84.84V6a.25.25 0 0 0-.25-.25H6Zm12 11.86v-4.57l-1.9-1.9a.25.25 0 0 0-.35 0l-2.83 2.83l-2.36-2.36a.25.25 0 0 0-.35 0l-4.46 4.46V18c0 .14.11.25.25.25h12a.25.25 0 0 0 .25-.25ZM15.5 8a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Z"
            fill="currentColor"
          />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.75a4.75 4.75 0 0 1 4.75 4.75v2.47c0 .67.19 1.33.55 1.9l.93 1.47a2 2 0 0 1-1.69 3.07H7.46a2 2 0 0 1-1.69-3.07l.93-1.47c.36-.57.55-1.23.55-1.9V8.5A4.75 4.75 0 0 1 12 3.75Zm0 1.5A3.25 3.25 0 0 0 8.75 8.5v2.47c0 .95-.27 1.88-.78 2.67l-.93 1.47a.5.5 0 0 0 .42.77h9.08a.5.5 0 0 0 .42-.77l-.93-1.47a4.96 4.96 0 0 1-.78-2.67V8.5A3.25 3.25 0 0 0 12 5.25Zm-1.72 13.5a.75.75 0 0 1 1.44 0a.75.75 0 0 0 1.44 0a.75.75 0 1 1 1.44 0a2.25 2.25 0 0 1-4.32 0Z"
            fill="currentColor"
          />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.62 3.47a.75.75 0 0 1 .76 0l7 4A.75.75 0 0 1 19.75 8v8a.75.75 0 0 1-.37.65l-7 4a.75.75 0 0 1-.76 0l-7-4A.75.75 0 0 1 4.25 16V8a.75.75 0 0 1 .37-.65l7-4ZM6.5 8.43v7.14l5 2.86v-7.14l-5-2.86Zm6.5 10 5-2.86V8.43l-5 2.86v7.14Zm-.75-8.44L17.48 7 12 3.87 6.52 7l5.73 2.99Z"
            fill="currentColor"
          />
        </svg>
      );
    case "crown":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5.1 6.42a1.35 1.35 0 1 1 0 2.7a1.35 1.35 0 0 1 0-2.7Zm13.8 0a1.35 1.35 0 1 1 0 2.7a1.35 1.35 0 0 1 0-2.7ZM12 4.25a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Zm-7.04 5.3a.75.75 0 0 1 .94.18l3.3 4.05l2.1-6.02a.75.75 0 0 1 1.42 0l2.1 6.02l3.3-4.05a.75.75 0 0 1 1.33.6l-1.44 7.25a.75.75 0 0 1-.73.6H6.72a.75.75 0 0 1-.73-.6L4.55 10.33a.75.75 0 0 1 .4-.78ZM7.33 16.68h9.34l.96-4.82l-2.8 3.43a.75.75 0 0 1-1.3-.2L12 10.88l-1.53 4.21a.75.75 0 0 1-1.3.2l-2.8-3.43l.96 4.82Z"
            fill="currentColor"
          />
        </svg>
      );
    case "gear":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 7.25A4.75 4.75 0 1 1 7.25 12A4.75 4.75 0 0 1 12 7.25Zm0 1.5A3.25 3.25 0 1 0 15.25 12A3.25 3.25 0 0 0 12 8.75Zm0-5a.75.75 0 0 1 .75.75v1.02a6.88 6.88 0 0 1 1.77.73l.72-.72a.75.75 0 1 1 1.06 1.06l-.72.72c.3.56.54 1.15.73 1.77h1.02a.75.75 0 0 1 0 1.5h-1.02a6.88 6.88 0 0 1-.73 1.77l.72.72a.75.75 0 1 1-1.06 1.06l-.72-.72a6.88 6.88 0 0 1-1.77.73v1.02a.75.75 0 0 1-1.5 0v-1.02a6.88 6.88 0 0 1-1.77-.73l-.72.72a.75.75 0 1 1-1.06-1.06l.72-.72a6.88 6.88 0 0 1-.73-1.77H4.5a.75.75 0 0 1 0-1.5h1.02c.19-.62.43-1.21.73-1.77l-.72-.72a.75.75 0 0 1 1.06-1.06l.72.72a6.88 6.88 0 0 1 1.77-.73V4.5A.75.75 0 0 1 12 3.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.75 5.25h8.5A3.5 3.5 0 0 1 18.75 8.75V9H19a1.75 1.75 0 0 1 1.75 1.75v6.5A1.75 1.75 0 0 1 19 19H7A2.75 2.75 0 0 1 4.25 16.25v-8.5A2.5 2.5 0 0 1 6.75 5.25Zm0 1.5a1 1 0 0 0-1 1v.22c.39-.3.88-.47 1.41-.47h10.09v-.75a2 2 0 0 0-2-2h-8.5Zm12.5 3H7a1.25 1.25 0 0 0-1.25 1.25v5.25c0 .69.56 1.25 1.25 1.25h12.25v-7.75Zm-3.75 2.5a1.75 1.75 0 1 1 0 3.5a1.75 1.75 0 0 1 0-3.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 3.25h8A2.75 2.75 0 0 1 18.75 6v12A2.75 2.75 0 0 1 16 20.75H8A2.75 2.75 0 0 1 5.25 18V6A2.75 2.75 0 0 1 8 3.25Zm0 1.5c-.69 0-1.25.56-1.25 1.25v12c0 .69.56 1.25 1.25 1.25h8c.69 0 1.25-.56 1.25-1.25V6c0-.69-.56-1.25-1.25-1.25H8Zm3 11.75h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5ZM9.75 7A.75.75 0 0 1 10.5 6.25h3a.75.75 0 0 1 0 1.5h-3A.75.75 0 0 1 9.75 7Z"
            fill="currentColor"
          />
        </svg>
      );
    case "home":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.47 4.6a.75.75 0 0 1 1.06 0l6.25 6.25a.75.75 0 0 1-.53 1.28H17.5v5a1.75 1.75 0 0 1-1.75 1.75h-2.5a.75.75 0 0 1-.75-.75V14h-1v4.13a.75.75 0 0 1-.75.75h-2.5A1.75 1.75 0 0 1 6.5 17.13v-5h-.75a.75.75 0 0 1-.53-1.28l6.25-6.25Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

type SidebarNavProps = {
  isWorkspaceLocked?: boolean;
  allowedPathsWhenLocked?: readonly string[];
  onNavigate?: () => void;
};

function matchesAllowedPath(pathname: string, allowedPaths: readonly string[]) {
  return allowedPaths.some(
    (allowedPath) =>
      pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}

export function SidebarNav({
  isWorkspaceLocked = false,
  allowedPathsWhenLocked = [],
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchedHrefsRef = useRef<Set<string>>(new Set());
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState<boolean>(true);
  const navigationGroups = isWorkspaceLocked
    ? [{ label: "Assinatura", items: lockedWorkspaceNav }]
    : dashboardNavGroups;
  const navigationItems = isWorkspaceLocked ? lockedWorkspaceNav : dashboardNav;

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const prefetchRoute = useCallback(
    (href: string) => {
      if (href === pathname || prefetchedHrefsRef.current.has(href)) {
        return;
      }

      prefetchedHrefsRef.current.add(href);
      router.prefetch(href);
    },
    [pathname, router],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (document.visibilityState === "hidden") {
      return;
    }

    const plan = buildRouteWarmupPlan(pathname, isWorkspaceLocked);
    const immediateRoutes = dedupeWarmupRoutes(pathname, plan.immediate);
    const extendedRoutes = dedupeWarmupRoutes(pathname, plan.extended);
    const runPrefetch = (routes: string[]) => {
      routes.forEach((href) => prefetchRoute(href));
    };

    const immediateTask = scheduleWarmupTask(
      () => runPrefetch(immediateRoutes),
      420,
    );
    let extendedTask: ScheduledTask | null = null;
    let extendedDelayHandle: number | null = null;

    if (extendedRoutes.length > 0 && shouldRunExtendedWarmup()) {
      extendedDelayHandle = window.setTimeout(() => {
        extendedTask = scheduleWarmupTask(
          () => runPrefetch(extendedRoutes),
          1400,
        );
      }, 900);
    }

    return () => {
      cancelWarmupTask(immediateTask);

      if (extendedDelayHandle != null) {
        window.clearTimeout(extendedDelayHandle);
      }

      cancelWarmupTask(extendedTask);
    };
  }, [isWorkspaceLocked, pathname, prefetchRoute]);

  const handleLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    isActive: boolean,
  ) => {
    if (
      isActive ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    onNavigate?.();
    setPendingHref(href);
    prefetchRoute(href);
  };

  const renderNavItem = (link: NavItem, options?: { compact?: boolean }) => {
    const isActive =
      link.href === "/dashboard"
        ? pathname === link.href
        : pathname === link.href || pathname.startsWith(`${link.href}/`);
    const isPending = pendingHref === link.href;
    const isDisabled =
      isWorkspaceLocked &&
      !matchesAllowedPath(link.href, allowedPathsWhenLocked);
    const className = isActive
      ? "nav-link nav-link--active"
      : isPending
        ? "nav-link nav-link--pending"
        : "nav-link";
    const classNameWithVariant = options?.compact
      ? `${className} nav-link--compact`
      : className;
    const mergedClassName = isDisabled
      ? `${classNameWithVariant} nav-link--disabled`
      : classNameWithVariant;

    if (isDisabled) {
      return (
        <span
          key={link.href}
          className={mergedClassName}
          aria-current={isActive ? "page" : undefined}
          aria-disabled="true"
        >
          <span className="nav-link__content">
            <span className="nav-link__icon" aria-hidden="true">
              <NavIcon name={link.icon} />
            </span>

            <span className="nav-link__text">
              <strong>{link.label}</strong>
              <small>{link.description}</small>
            </span>
          </span>

          <span className="nav-link__pulse" aria-hidden="true" />
        </span>
      );
    }

    return (
      <Link
        key={link.href}
        href={link.href}
        className={mergedClassName}
        aria-current={isActive ? "page" : undefined}
        aria-busy={isPending ? "true" : undefined}
        data-pending={isPending ? "true" : "false"}
        onMouseEnter={() => prefetchRoute(link.href)}
        onTouchStart={() => prefetchRoute(link.href)}
        onFocus={() => prefetchRoute(link.href)}
        onClick={(event) => handleLinkClick(event, link.href, isActive)}
      >
        <span className="nav-link__content">
          <span className="nav-link__icon" aria-hidden="true">
            <NavIcon name={link.icon} />
          </span>

          <span className="nav-link__text">
            <strong>{link.label}</strong>
            <small>{link.description}</small>
          </span>
        </span>

        <span className="nav-link__pulse" aria-hidden="true" />
      </Link>
    );
  };

  return (
    <nav className="sidebar-nav" aria-label="Navegação do painel">
      <div
        className={
          pendingHref
            ? "sidebar-progress sidebar-progress--active"
            : "sidebar-progress"
        }
        aria-hidden="true"
      />
      <div className="sidebar-section">
        <div className="sidebar-section__header">
          <div className="sidebar-section__copy">
            <span className="sidebar-section__label">
              {isWorkspaceLocked ? "Ativação do painel" : "Essencial"}
            </span>
            <p className="sidebar-section__description">
              {isWorkspaceLocked
                ? "Finalize a assinatura para liberar a operação completa do salão."
                : "O que move o salão e o app do cliente."}
            </p>
          </div>
          <span className="sidebar-section__count" aria-hidden="true">
            {navigationItems.length}
          </span>
        </div>

        <div className="sidebar-section__body sidebar-section__body--stacked">
          {navigationGroups.map((group) => (
            <div key={group.label} className="sidebar-nav-group">
              <div className="sidebar-nav-group__header">
                <span className="sidebar-nav-group__label">{group.label}</span>
                <span className="sidebar-nav-group__count" aria-hidden="true">
                  {group.items.length}
                </span>
              </div>

              <div className="sidebar-nav-group__body">
                {group.items.map((link) =>
                  renderNavItem(link, { compact: !isWorkspaceLocked }),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {false ? (
      <div className="sidebar-section sidebar-section--secondary">
        <div className="sidebar-section__header">
          <div className="sidebar-section__copy">
            <span className="sidebar-section__label">
              {isWorkspaceLocked ? "Depois da assinatura" : "Complementos"}
            </span>
            <p className="sidebar-section__description">
              {isWorkspaceLocked
                ? "Assim que a assinatura for confirmada, as demais áreas aparecem aqui."
                : "Campanhas, vitrine e ajustes que entram menos no fluxo."}
            </p>
          </div>

          {!isWorkspaceLocked ? (
            <button
              type="button"
              className="sidebar-section__toggle"
              onClick={() => setShowExtras((value) => !value)}
              aria-expanded={showExtras}
            >
              <span>{showExtras ? "Recolher" : "Expandir"}</span>
              <strong>{navigationItems.length}</strong>
            </button>
          ) : (
            <span className="sidebar-section__count" aria-hidden="true">
              {navigationItems.length}
            </span>
          )}
        </div>

        {showExtras || isWorkspaceLocked ? (
          <div className="sidebar-section__body sidebar-section__body--stacked">
            {navigationGroups.map((group) => (
              <div key={group.label} className="sidebar-nav-group">
                <div className="sidebar-nav-group__header">
                  <span className="sidebar-nav-group__label">
                    {group.label}
                  </span>
                  <span className="sidebar-nav-group__count" aria-hidden="true">
                    {group.items.length}
                  </span>
                </div>

                <div className="sidebar-nav-group__body">
                  {group.items.map((link) =>
                    renderNavItem(link, { compact: true }),
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}
    </nav>
  );
}
