import { THEME_BOOTSTRAP } from "@/lib/theme-bootstrap";
import { registerAction } from "./actions";
import { RegisterExperience } from "./register-experience";

export default async function RegistroPage(
  props: {
    searchParams: Promise<{ erro?: string; retorno?: string; plano?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const selectedPlan = searchParams.plano?.toUpperCase() === "PERSONAL" ? "PERSONAL" : "ESSENTIAL";
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      <RegisterExperience action={registerAction} errorMessage={searchParams.erro} returnTo={searchParams.retorno} initialPlan={selectedPlan} />
    </>
  );
}
