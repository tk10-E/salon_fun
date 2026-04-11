import { redirect } from "next/navigation";

import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

type GestaoPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default function GestaoPage({ searchParams }: GestaoPageProps) {
  const params = new URLSearchParams();

  if (searchParams?.message?.trim()) {
    params.set("message", searchParams.message.trim());
  }

  if (searchParams?.tone?.trim()) {
    params.set("tone", searchParams.tone.trim());
  }

  const query = params.toString();
  redirect(
    `${MANAGEMENT_ROUTES.appointments}${query ? `?${query}` : ""}`,
  );
}
