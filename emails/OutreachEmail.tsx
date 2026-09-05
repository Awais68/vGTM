import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from "@react-email/components"

interface Props {
  firstName: string
  senderName: string
  senderTitle: string
  messageContent: string
  leadId: string
  unsubscribeToken: string
}

export default function OutreachEmail({
  firstName,
  senderName,
  senderTitle,
  messageContent,
  leadId,
  unsubscribeToken,
}: Props) {
  const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/email/unsubscribe?leadId=${leadId}&token=${unsubscribeToken}`

  return (
    <Html>
      <Head />
      <Preview>Message from {senderName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Text style={greeting}>Hi {firstName},</Text>
            <Text style={paragraph}>{messageContent}</Text>
          </Section>
          <Hr style={hr} />
          <Section>
            <Text style={signature}>
              Best regards,
              <br />
              {senderName}
              <br />
              {senderTitle}
            </Text>
          </Section>
          <Hr style={hr} />
          <Section style={footer}>
            <Link href={unsubscribeUrl} style={unsubscribeLink}>
              Unsubscribe
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  backgroundColor: "#f6f6f6",
  margin: "0",
  padding: "0",
}

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "40px 20px",
  backgroundColor: "#ffffff",
}

const greeting = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#333",
}

const paragraph = {
  fontSize: "15px",
  lineHeight: "22px",
  color: "#444",
  whiteSpace: "pre-wrap" as const,
}

const hr = {
  borderColor: "#e0e0e0",
  margin: "24px 0",
}

const signature = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#555",
}

const footer = {
  textAlign: "center" as const,
}

const unsubscribeLink = {
  fontSize: "12px",
  color: "#999",
  textDecoration: "underline",
}
