import { useStorybookApi } from "@storybook/manager-api";
import { color } from "@storybook/theming";
import React, { useCallback, useState } from "react";

import { ADDON_ID } from "../../constants";
import { initiateSignin, TokenExchangeParameters } from "../../utils/requestAccessToken";
import { SetSubdomain } from "./SetSubdomain";
import { SignIn } from "./SignIn";
import { Verify } from "./Verify";
import { Welcome } from "./Welcome";

interface AuthenticationProps {
  setAccessToken: (token: string) => void;
  hasProjectId: boolean;
}

type AuthenticationScreen = "welcome" | "signin" | "subdomain" | "verify";

export const Authentication = ({ setAccessToken, hasProjectId }: AuthenticationProps) => {
  const api = useStorybookApi();
  const [screen, setScreen] = useState<AuthenticationScreen>(hasProjectId ? "signin" : "welcome");
  const [exchangeParameters, setExchangeParameters] = useState<TokenExchangeParameters>();

  const initiateSignInAndMoveToVerify = useCallback(
    async (subdomain?: string) => {
      try {
        setExchangeParameters(await initiateSignin(subdomain));
        setScreen("verify");
      } catch (err: any) {
        // TODO API for this
        api.addNotification({
          id: `${ADDON_ID}/signin-error`,
          content: {
            headline: "Sign in Error",
            subHeadline: err.toString(),
          },
          icon: {
            name: "failed",
            color: color.negative,
          },
          // @ts-expect-error SB needs a proper API for no link
          link: undefined,
        });
      }
    },
    [api]
  );

  if (screen === "welcome" && !hasProjectId) {
    return <Welcome onNext={() => setScreen("signin")} />;
  }

  if (screen === "signin" || (screen === "welcome" && hasProjectId)) {
    return (
      <SignIn
        {...(!hasProjectId ? { onBack: () => setScreen("welcome") } : {})}
        onSignIn={initiateSignInAndMoveToVerify}
        onSignInWithSSO={() => setScreen("subdomain")}
      />
    );
  }

  if (screen === "subdomain") {
    return (
      <SetSubdomain onBack={() => setScreen("signin")} onSignIn={initiateSignInAndMoveToVerify} />
    );
  }

  if (screen === "verify") {
    if (!exchangeParameters) {
      throw new Error("Expected to have a `exchangeParameters` if at `verify` step");
    }
    return (
      <Verify
        onBack={() => setScreen("signin")}
        setAccessToken={setAccessToken}
        exchangeParameters={exchangeParameters}
      />
    );
  }

  return null;
};
