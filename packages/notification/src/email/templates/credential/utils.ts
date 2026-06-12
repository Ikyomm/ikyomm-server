type CredentialAuthLinkOptions = {
  credEmail?: string;
  credPassword?: string;
  softwareUrl: string;
};

export const createCredentialAuthLink = ({
  credEmail = "",
  credPassword = "",
  softwareUrl,
}: CredentialAuthLinkOptions) => {
  const authUrl = new URL("/auth", softwareUrl);
  authUrl.search = [
    `cred_email=${encodeURIComponent(credEmail)}`,
    `cred_password=${encodeURIComponent(credPassword)}`,
    "button_action=auto",
  ].join("&");

  return authUrl.toString();
};
