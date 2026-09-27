import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import { redirect } from "next/navigation";
import { getMfaChallengeToken } from "@/lib/session";
import { completeMfaAction } from "./actions";
import { MfaForm } from "./mfa-form";

export default function MfaPage({ searchParams }: { searchParams: { retorno?: string } }) {
  if (!getMfaChallengeToken()) redirect("/login");
  return <MfaForm action={completeMfaAction} returnTo={searchParams.retorno} />;
}
