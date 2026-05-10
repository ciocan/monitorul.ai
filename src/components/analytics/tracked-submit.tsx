"use client";

import { trackMcpOauthCompleted, trackMcpOauthStarted } from "@/lib/analytics";

// Form-wrapping helpers for the MCP OAuth funnel. The handoff documents
// two events: `started` (user clicks Connect-with-Google from the DCR flow)
// and `completed` (user clicks Accept on the consent screen). Both surfaces
// already use `<form action={serverAction}>` shape, so the wrappers
// preserve the server-action contract and tack on an `onSubmit` listener
// that fires the event synchronously before React processes the action.

type FormAction = string | ((formData: FormData) => void | Promise<void>);

interface OauthFormProps extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  "action" | "onSubmit"
> {
  action: FormAction;
  clientName: string;
  children: React.ReactNode;
}

export function McpOauthStartedForm({ action, clientName, children, ...rest }: OauthFormProps) {
  return (
    <form
      {...rest}
      action={action}
      onSubmit={() => trackMcpOauthStarted({ client_name: clientName })}
    >
      {children}
    </form>
  );
}

export function McpOauthCompletedForm({ action, clientName, children, ...rest }: OauthFormProps) {
  return (
    <form
      {...rest}
      action={action}
      onSubmit={() => trackMcpOauthCompleted({ client_name: clientName })}
    >
      {children}
    </form>
  );
}
