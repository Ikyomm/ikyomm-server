import { Img, Section } from "react-email";
import { type EmailPanel, getEmailPanelConfig } from "../static/const";

type EmailHeaderProps = {
  panel?: EmailPanel;
};

export default function EmailHeader({ panel = "ikyomm" }: EmailHeaderProps) {
  const brand = getEmailPanelConfig(panel);
  const logoSize = panel === "ommpods" ? { height: 40, width: 100 } : { height: 60, width: 60 };

  return (
    <Section className="mobile:px-6! px-8 pt-10">
      <Img
        alt={brand.name}
        className="block border-none"
        height={logoSize.height}
        src={brand.logoPath}
        width={logoSize.width}
      />
    </Section>
  );
}
