import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import { LoginExperience } from "./login-experience";
import { loginAction } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string; cadastrado?: string; retorno?: string; verificacao?: string; preview?: string; emailVerificado?: string; senhaRedefinida?: string };
}) {
  return (
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
  );
}
