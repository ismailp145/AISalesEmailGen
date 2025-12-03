import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

export function isSendGridConfigured(): boolean {
  return !!SENDGRID_API_KEY;
}

export function initSendGrid() {
  if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log("[SendGrid] Configured and ready");
  } else {
    console.log("[SendGrid] Not configured - add SENDGRID_API_KEY secret to enable");
  }
}

interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  body: string;
}

export async function sendEmail({ to, from, subject, body }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    return {
      success: false,
      error: "SendGrid is not configured. Add your SENDGRID_API_KEY in Secrets.",
    };
  }

  try {
    await sgMail.send({
      to,
      from,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    });

    console.log(`[SendGrid] Email sent to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error("[SendGrid] Error sending email:", error);
    
    const message = error?.response?.body?.errors?.[0]?.message 
      || error?.message 
      || "Failed to send email";
    
    return {
      success: false,
      error: message,
    };
  }
}
