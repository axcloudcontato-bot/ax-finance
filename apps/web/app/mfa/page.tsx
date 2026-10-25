import { THEME_BOOTSTRAP } from "@/lib/theme-bootstrap";
import { redirect } from "next/navigation";
import { getMfaChallengeToken } from "@/lib/session";
import { completeMfaAction } from "./actions";
import { MfaForm } from "./mfa-form";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ retorno?: string }> }) {
  if (!(await getMfaChallengeToken())) redirect("/login");
  const resolvedSearchParams = await searchParams;
  return <><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /><MfaForm action={completeMfaAction} returnTo={resolvedSearchParams.retorno} /></>;
}
