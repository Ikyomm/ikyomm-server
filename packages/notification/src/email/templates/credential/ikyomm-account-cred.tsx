import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  pretty,
  render,
  Text,
} from "react-email";
import { SatoshiFonts } from "../satoshi-fonts";
import { collageTailwindConfig } from "../theme";
import { getEmailPanelConfig } from "../../static/const";
import EmailHeader from "../../components/email-header";
import { CredentialsBox } from "../../components/credentials-box";
import { EmailButton } from "../../components/email-button";
import Footer from "../../components/footer";
import { createCredentialAuthLink } from "./utils";

const defaultData = {
  previewText: "You're invited to join Ikyomm!",
  credEmail: "mondalsuman97322@gmail.com",
  credPassword: "password123",
  role: "Admin",
};

type IkyommAccountCredEmailProps = {
  previewText: string;
  credEmail?: string;
  credPassword?: string;
  role?: string;
};

export const IkyommAccountCredEmail = ({
  previewText,
  credEmail = "",
  credPassword = "",
  role,
}: IkyommAccountCredEmailProps) => {
  const brand = getEmailPanelConfig("ikyomm");
  const getStartedLink = createCredentialAuthLink({
    credEmail,
    credPassword,
    softwareUrl: brand.adminUrl,
  });

  return (
    <Tailwind config={collageTailwindConfig}>
      <Html>
        <Head>
          <SatoshiFonts />
        </Head>
        <Body className="bg-canvas font-14 font-inter text-fg m-0 p-0">
          <Preview>{previewText}</Preview>
          <Container className="mx-auto max-w-[580px] px-4 pt-16 pb-6">
            <Section>
              <Section className="bg-bg border-stroke border">
                <EmailHeader panel="ikyomm" />
                <Section className="mobile:px-6! px-8 pt-8 pb-10">
                  <Text className="font-32 text-fg m-0 font-sans">Welcome to Ikyomm</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-4">Hello,</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Your Ikyomm account has been successfully set up as a{" "}
                    <span className="font-semibold text-fg">{role?.toUpperCase()}</span>.
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Here's your Login Details:
                  </Text>
                  <CredentialsBox email={credEmail} password={credPassword} />
                  <EmailButton href={getStartedLink}>Accept Invitation&nbsp;&nbsp;→</EmailButton>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[18px]">
                    We're excited to have you onboard. Start collaborating with your team.
                  </Text>
                  <Section className="mt-6">
                    <Text className="font-14 font-inter text-fg-2 m-0">
                      Best Regards,
                      <br />
                      <Link
                        href={brand.websiteUrl}
                        className="font-14 font-[700] text-brand underline"
                      >
                        {brand.teamName}
                      </Link>
                    </Text>
                  </Section>
                </Section>
                <Footer panel="ikyomm" />
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

IkyommAccountCredEmail.PreviewProps = defaultData;

export default IkyommAccountCredEmail;

export const renderIkyommAccountCredEmail = async (props: IkyommAccountCredEmailProps) =>
  pretty(await render(<IkyommAccountCredEmail {...props} />));
