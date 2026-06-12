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
  previewText: "You're now a registered Agent on Ommpods!",
  credEmail: "agent@example.com",
  credPassword: "password123",
  agentName: "Suman Mondal",
  regionName: "INDIA",
  zoneName: "EAST",
};

type AgentCredEmailProps = {
  previewText: string;
  credEmail?: string;
  credPassword?: string;
  agentName?: string;
  regionName?: string;
  zoneName?: string;
};

export const AgentCredEmail = ({
  previewText,
  credEmail = "",
  credPassword = "",
  agentName,
  regionName,
  zoneName,
}: AgentCredEmailProps) => {
  const brand = getEmailPanelConfig("ommpods");
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
                <EmailHeader panel="ommpods" />
                <Section className="mobile:px-6! px-8 pt-8 pb-10">
                  <Text className="font-32 text-fg m-0 font-sans">Welcome to Ommpods</Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-4">
                    Hello{agentName ? `, ${agentName}` : ""},
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    You have been successfully registered as a{" "}
                    <span className="font-semibold text-fg">Agent</span> on Ommpods.
                    {regionName || zoneName ? (
                      <>
                        {" "}
                        You are assigned to{" "}
                        {zoneName ? (
                          <>
                            <span className="font-semibold text-fg">{zoneName}</span>
                            {regionName ? (
                              <>
                                {" "}
                                zone under the{" "}
                                <span className="font-semibold text-fg">{regionName}</span> region
                              </>
                            ) : null}
                          </>
                        ) : (
                          <>
                            the <span className="font-semibold text-fg">{regionName}</span> region
                          </>
                        )}
                        .
                      </>
                    ) : null}
                  </Text>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[10px]">
                    Here are your login credentials to get started:
                  </Text>
                  <CredentialsBox email={credEmail} password={credPassword} />
                  <EmailButton href={getStartedLink}>Get Started&nbsp;&nbsp;→</EmailButton>
                  <Text className="font-14 font-inter text-fg-2 m-0 mt-[18px]">
                    Please change your password after your first login. If you have any questions,
                    feel free to reach out to our support team.
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
                <Footer panel="ommpods" />
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

AgentCredEmail.PreviewProps = defaultData;

export default AgentCredEmail;

export const renderAgentCredEmail = async (props: AgentCredEmailProps) =>
  pretty(await render(<AgentCredEmail {...props} />));
