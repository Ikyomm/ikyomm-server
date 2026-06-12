export const imgesdata = {
  ikyommLogoPath: "https://logistics-bucket.in-maa-1.linodeobjects.com/Static/ikyomm.png",
  ommpodsLogoPath: "https://logistics-bucket.in-maa-1.linodeobjects.com/Static/ommpods.png",
  instagramIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkzKy0y33pqTPoMKVeJLNZvy76iQAB31SfgX2W",
  facebookIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkPMrd9hkTCVLKoj6mbtiv27lR31SAkuBNx8aU",
  linkedinIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkdmoUd0O1k0eSKmV8DXcrOfGNHaRQ62vy9tPp",
  twitterIcon: "https://mpv9ew6qdy.ufs.sh/f/oIwSgOhCUnBkKCNGEI811ktboWcYL0IhDM8a49TJ52j6iy3A",
};

export type EmailPanel = "ikyomm" | "ommpods";
export type EmailKind =
  | "sign-in"
  | "forget-password"
  | "account-credentials"
  | "ikyomm-account-cred"
  | "ikyomm-app-account-cred"
  | "member-account-cred"
  | "ommpods-account-cred"
  | "agent-cred";

export const metadata = {
  ikyomm: "https://ikyomm.com",
  ommpods: "https://ommpods.com",
  adminUrl: "https://admin.ikyomm.com",
  businessUrl: "https://business.ommpods.com",
  adminSoftwareUrl: "https://admin.ikyomm.com",
  businessSoftwareUrl: "https://business.ommpods.com",
  mainpageUrl: "https://ommpods.com",
  privacyPolicyUrl: "https://www.ommpods.app/privacy-policy-developer",
  termsAndConditionsUrl: "https://www.ommpods.app/terms-of-service",
  instagramUrl: "https://instagram.com",
  facebookUrl: "https://facebook.com",
  linkedinUrl: "https://linkedin.com",
  twitterUrl: "https://twitter.com",
};

export const emailPanelConfig: Record<
  EmailPanel,
  {
    name: string;
    teamName: string;
    logoPath: string;
    websiteUrl: string;
    adminUrl: string;
    businessUrl: string;
    termsUrl: string;
    privacyPolicyUrl: string;
    accountLabel: string;
  }
> = {
  ikyomm: {
    name: "Ikyomm",
    teamName: "The Ikyomm Team",
    logoPath: imgesdata.ikyommLogoPath,
    websiteUrl: metadata.ikyomm,
    adminUrl: metadata.adminUrl,
    businessUrl: metadata.businessUrl,
    termsUrl: metadata.termsAndConditionsUrl,
    privacyPolicyUrl: metadata.privacyPolicyUrl,
    accountLabel: "Ikyomm",
  },
  ommpods: {
    name: "Ommpods",
    teamName: "Ommpods Team",
    logoPath: imgesdata.ommpodsLogoPath,
    websiteUrl: metadata.ommpods,
    adminUrl: metadata.adminUrl,
    businessUrl: metadata.businessUrl,
    termsUrl: metadata.termsAndConditionsUrl,
    privacyPolicyUrl: metadata.privacyPolicyUrl,
    accountLabel: "Ommpods",
  },
};

export const resolveEmailPanel = (panel?: string | null): EmailPanel =>
  panel === "ommpods" ? "ommpods" : "ikyomm";

export const getEmailPanelConfig = (panel: EmailPanel = "ikyomm") => emailPanelConfig[panel];

export const getPanelBranding = getEmailPanelConfig;

type EmailSubPrev = {
  subject: string;
  previewText: string;
};

export const emailSubject: Record<EmailKind, EmailSubPrev> = {
  "sign-in": {
    subject: "Your Ikyomm Sign-In Code",
    previewText: "Use this code to sign in to your Ikyomm account. It expires in 10 minutes.",
  },
  "forget-password": {
    subject: "Reset Your Ikyomm Password",
    previewText: "Your Ikyomm password reset verification code.",
  },
  "account-credentials": {
    subject: "Your Ommpods Account Credentials",
    previewText: "Here are your Ommpods account login credentials.",
  },
  "ikyomm-account-cred": {
    subject: "Your Ikyomm Account Credentials",
    previewText: "Here are your Ikyomm account login credentials.",
  },
  "ikyomm-app-account-cred": {
    subject: "Your Ikyomm App Account Credentials",
    previewText: "Here are your Ikyomm app account login credentials.",
  },
  "member-account-cred": {
    subject: "Your Ommpods Account Credentials",
    previewText: "Here are your Ommpods account login credentials.",
  },
  "ommpods-account-cred": {
    subject: "Your Ommpods Account Credentials",
    previewText: "Here are your Ommpods account login credentials.",
  },
  "agent-cred": {
    subject: "You're now an Agent on Ommpods - Here are your credentials",
    previewText: "You're now a registered Agent on Ommpods!",
  },
};

export const emailSubjectsByPanel: Record<EmailPanel, Partial<Record<EmailKind, EmailSubPrev>>> = {
  ikyomm: {
    "sign-in": {
      subject: "Your Ikyomm Sign-In Code",
      previewText: "Use this code to sign in to your Ikyomm account. It expires in 10 minutes.",
    },
    "forget-password": {
      subject: "Reset Your Ikyomm Password",
      previewText: "Your Ikyomm password reset verification code.",
    },
    "ikyomm-account-cred": emailSubject["ikyomm-account-cred"],
    "ikyomm-app-account-cred": emailSubject["ikyomm-app-account-cred"],
  },
  ommpods: {
    "sign-in": {
      subject: "Your Ommpods Sign-In Code",
      previewText: "Use this code to sign in to your Ommpods account. It expires in 10 minutes.",
    },
    "forget-password": {
      subject: "Reset Your Ommpods Password",
      previewText: "Your Ommpods password reset verification code.",
    },
    "ikyomm-app-account-cred": emailSubject["ikyomm-app-account-cred"],
    "account-credentials": emailSubject["account-credentials"],
    "member-account-cred": emailSubject["member-account-cred"],
    "ommpods-account-cred": emailSubject["ommpods-account-cred"],
    "agent-cred": emailSubject["agent-cred"],
  },
};

export const getEmailSubject = (kind: EmailKind, panel: EmailPanel = "ikyomm") =>
  emailSubjectsByPanel[panel][kind] ?? emailSubject[kind];
