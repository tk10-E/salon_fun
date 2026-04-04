"use client";

import { useState } from "react";

import { signOutPanelFirebaseSession } from "@/lib/firebase/panelAuth";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.25 4.75a.75.75 0 0 1 .75-.75h2.25A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H15a.75.75 0 0 1 0-1.5h2.25c.69 0 1.25-.56 1.25-1.25V6.75c0-.69-.56-1.25-1.25-1.25H15a.75.75 0 0 1-.75-.75Zm-7.72 6.72a.75.75 0 0 0 0 1.06l3 3a.75.75 0 1 0 1.06-1.06l-1.72-1.72H15a.75.75 0 0 0 0-1.5H8.87l1.72-1.72a.75.75 0 1 0-1.06-1.06l-3 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PanelSignOutButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    if (isPending) {
      return;
    }

    setIsPending(true);

    try {
      const supabase = createSupabaseBrowserClient();

      await Promise.allSettled([
        signOutPanelFirebaseSession(),
        supabase.auth.signOut(),
      ]);
    } finally {
      window.location.assign(
        "/login?message=Voce+saiu+do+painel+com+seguranca.&tone=info",
      );
    }
  }

  return (
    <div className="sidebar-signout">
      <button type="button" className="sidebar-signout__button" onClick={handleSignOut} disabled={isPending}>
        <span className="sidebar-signout__icon">
          <LogoutIcon />
        </span>
        {isPending ? "Saindo..." : "Sair do painel"}
      </button>
    </div>
  );
}
