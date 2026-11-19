import { useState } from "react";
import { Droplets } from "lucide-react";
import { authClient } from "../lib/auth";
import { SaveForm, Field, ErrorMessage } from "../components/UI";

export default function Auth({ onAuthenticated }) {
  const resetToken = new URLSearchParams(window.location.search).get("token");
  const [view, setView] = useState(resetToken ? "reset" : "signin");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  if (!authClient)
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="panel max-w-lg p-8">
          <Droplets className="text-blue-600 mb-4" size={36} />
          <h1 className="text-2xl font-bold">Connect your station</h1>
          <p className="mt-3 text-slate-500">
            Configure your station's Neon Auth connection and restart the app.
            Follow the deployment guide in the repository to connect Neon Auth
            and Postgres.
          </p>
        </div>
      </div>
    );
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-950 dark:to-slate-900">
      <div className="panel w-full max-w-md p-8">
        <div className="flex gap-3 items-center mb-7">
          <Droplets className="text-blue-600" size={36} />
          <div>
            <h1 className="text-2xl font-bold">AquaFlow</h1>
            <p className="text-sm text-slate-500">
              Water refilling station management
            </p>
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-2">
          {
            {
              signin: "Welcome back",
              signup: "Create your staff account",
              forgot: "Reset your password",
              reset: "Choose a new password",
              verify: "Verify your email",
            }[view]
          }
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Only verified, approved station staff can access business records.
        </p>
        {notice && (
          <div
            role="status"
            className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200 rounded-lg p-3 mb-4"
          >
            {notice}
          </div>
        )}
        <SaveForm
          key={view}
          label={
            {
              signin: "Sign in",
              signup: "Create account",
              forgot: "Send reset link",
              reset: "Reset password",
              verify: "Verify email",
            }[view]
          }
          onSubmit={async (d) => {
            setNotice("");
            let result;
            if (view === "forgot") {
              result = await authClient.requestPasswordReset({
                email: d.email,
                redirectTo: `${window.location.origin}/auth/reset-password`,
              });
              if (result.error) throw new Error(result.error.message);
              setNotice(
                "If an account exists, a reset link has been sent. Check your email.",
              );
              return;
            }
            if (view === "reset") {
              result = await authClient.resetPassword({
                newPassword: d.password,
                token: resetToken,
              });
              if (result.error) throw new Error(result.error.message);
              window.history.replaceState({}, "", "/");
              setView("signin");
              setNotice("Password reset. You can sign in now.");
              return;
            }
            if (view === "verify") {
              result = await authClient.emailOtp.verifyEmail({
                email,
                otp: d.otp,
              });
              if (result.error) throw new Error(result.error.message);
              setView("signin");
              setNotice("Email verified. Sign in to continue.");
              return;
            }
            setEmail(d.email);
            let authError;
            try {
              result =
                view === "signup"
                  ? await authClient.signUp.email(d)
                  : await authClient.signIn.email(d);
              authError = result.error;
            } catch (error) {
              authError = error;
            }
            if (authError) {
              // Neon can throw a normalized SDK error or return a raw API error.
              const codes = [authError.code, authError.error?.code];
              if (
                codes.some((code) =>
                  ["EMAIL_NOT_VERIFIED", "email_not_confirmed"].includes(code),
                )
              ) {
                setView("verify");
                setNotice("Verify your email using the code sent by Neon.");
                return;
              }
              throw new Error(authError.message || "Could not sign in.");
            }
            const session = await authClient.getSession();
            if (session.error) throw new Error(session.error.message);
            if (session.data?.user?.emailVerified && session.data?.session)
              onAuthenticated(session.data.user);
            else {
              setView("verify");
              setNotice("Check your email for a verification code.");
            }
          }}
        >
          {view === "signup" && (
            <Field label="Full name">
              <input
                className="input"
                name="name"
                autoComplete="name"
                maxLength={200}
                required
              />
            </Field>
          )}
          {["signin", "signup", "forgot"].includes(view) && (
            <Field label="Email address">
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={email}
                maxLength={254}
                required
              />
            </Field>
          )}
          {["signin", "signup", "reset"].includes(view) && (
            <Field
              label="Password"
              hint={
                view !== "signin" ? "Use at least 8 characters." : undefined
              }
            >
              <input
                className="input"
                name="password"
                type="password"
                autoComplete={
                  view === "signin" ? "current-password" : "new-password"
                }
                minLength={8}
                maxLength={128}
                required
              />
            </Field>
          )}
          {view === "verify" && (
            <Field label={`Verification code for ${email}`}>
              <input
                className="input"
                name="otp"
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                maxLength={10}
              />
            </Field>
          )}
        </SaveForm>
        <div className="flex flex-wrap gap-4 mt-5 text-sm">
          <button
            className="text-blue-600"
            onClick={() => {
              setNotice("");
              setView(view === "signup" ? "signin" : "signup");
            }}
          >
            {view === "signup" ? "Back to sign in" : "Create staff account"}
          </button>
          {view !== "signin" ? (
            <button
              className="text-blue-600"
              onClick={() => {
                setView("signin");
                setNotice("");
              }}
            >
              Sign in
            </button>
          ) : (
            <button
              className="text-blue-600"
              onClick={() => {
                setNotice("");
                setView("forgot");
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
        {view === "verify" && <ResendCode email={email} />}
      </div>
    </div>
  );
}
function ResendCode({ email }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4">
      <button
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await authClient.emailOtp.sendVerificationOtp({
              email,
              type: "email-verification",
            });
            if (result.error) throw new Error(result.error.message);
            setMessage("Verification code sent.");
          } catch (error) {
            setMessage(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Resend verification code
      </button>
      <ErrorMessage>{message}</ErrorMessage>
    </div>
  );
}
