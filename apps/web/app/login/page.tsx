import { THEME_BOOTSTRAP } from "@/lib/theme-bootstrap";
import { LoginExperience } from "./login-experience";
import { loginAction } from "./actions";

export default async function LoginPage(
  props: {
    searchParams: Promise<{ erro?: string; cadastrado?: string; retorno?: string; verificacao?: string; preview?: string; emailVerificado?: string; senhaRedefinida?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
    <LoginExperience
      action={loginAction}
      errorMessage={searchParams.erro}
      registrationCompleted={Boolean(searchParams.cadastrado)}
      returnTo={searchParams.retorno}
      verificationRequired={searchParams.verificacao === "pendente"}
      previewLink={searchParams.preview}
      emailVerified={Boolean(searchParams.emailVerificado)}
      passwordReset={Boolean(searchParams.senhaRedefinida)}
    />
    </>
  );
}
