"use client";

import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
} from "react";

import { FlashMessage } from "@/components/FlashMessage";
import {
  markInlineAction,
  type InlineActionState,
  type InlineActionTone,
} from "@/lib/inline-action-state";

type AsyncAction = (formData: FormData) => Promise<InlineActionState | void>;

type AsyncActionNoticeContextValue = {
  setNotice: (value: InlineActionState | null) => void;
};

const AsyncActionNoticeContext =
  createContext<AsyncActionNoticeContextValue | null>(null);

type AsyncActionNoticeRegionProps = {
  children: ReactNode;
  initialMessage?: string;
  initialTone?: string;
};

type AsyncActionFormProps = Omit<
  ComponentPropsWithoutRef<"form">,
  "action" | "children"
> & {
  action: AsyncAction;
  children: ReactNode;
  refreshOnSuccess?: boolean;
  resetOnSuccess?: boolean;
};

function normalizeTone(tone?: string): InlineActionTone {
  if (tone === "success" || tone === "error" || tone === "info") {
    return tone;
  }

  return "info";
}

function NoticeBlock({ notice }: { notice: InlineActionState | null }) {
  if (!notice) {
    return null;
  }

  return <FlashMessage message={notice.message} tone={notice.tone} />;
}

function useOptionalAppRouter(): AppRouterInstance | null {
  return useContext(AppRouterContext);
}

export function AsyncActionNoticeRegion({
  children,
  initialMessage,
  initialTone,
}: AsyncActionNoticeRegionProps) {
  const [notice, setNotice] = useState<InlineActionState | null>(
    initialMessage
      ? {
          ok: normalizeTone(initialTone) !== "error",
          message: initialMessage,
          tone: normalizeTone(initialTone),
        }
      : null,
  );

  useEffect(() => {
    if (!initialMessage) {
      return;
    }

    setNotice({
      ok: normalizeTone(initialTone) !== "error",
      message: initialMessage,
      tone: normalizeTone(initialTone),
    });
  }, [initialMessage, initialTone]);

  return (
    <AsyncActionNoticeContext.Provider value={{ setNotice }}>
      <NoticeBlock notice={notice} />
      {children}
    </AsyncActionNoticeContext.Provider>
  );
}

export function AsyncActionForm({
  action,
  children,
  refreshOnSuccess = true,
  resetOnSuccess = false,
  ...props
}: AsyncActionFormProps) {
  const router = useOptionalAppRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const noticeContext = useContext(AsyncActionNoticeContext);
  const [isPending, setIsPending] = useState(false);
  const [localNotice, setLocalNotice] = useState<InlineActionState | null>(null);

  async function submitFormData(formData: FormData) {
    setIsPending(true);
    noticeContext?.setNotice(null);
    setLocalNotice(null);
    markInlineAction(formData);

    try {
      const result = await action(formData);

      if (!result) {
        if (refreshOnSuccess) {
          router?.refresh();
        }

        return;
      }

      if (noticeContext) {
        noticeContext.setNotice(result);
      } else {
        setLocalNotice(result);
      }

      if (result.ok && resetOnSuccess) {
        formRef.current?.reset();
      }

      if (result.ok && refreshOnSuccess) {
        router?.refresh();
      }
    } catch {
      const fallbackNotice = {
        ok: false,
        message: "Não foi possível concluir essa ação agora.",
        tone: "error",
      } satisfies InlineActionState;

      if (noticeContext) {
        noticeContext.setNotice(fallbackNotice);
      } else {
        setLocalNotice(fallbackNotice);
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    await submitFormData(new FormData(event.currentTarget));
  }

  return (
    <form
      {...props}
      ref={formRef}
      onSubmit={handleSubmit}
      aria-busy={isPending}
      data-pending={isPending ? "true" : "false"}
    >
      {!noticeContext ? <NoticeBlock notice={localNotice} /> : null}
      <fieldset
        disabled={isPending}
        style={{ border: 0, margin: 0, minInlineSize: 0, padding: 0 }}
      >
        {children}
      </fieldset>
    </form>
  );
}
