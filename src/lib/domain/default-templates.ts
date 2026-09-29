// Default message templates (docs/08 §2–§6). Single source of truth: the
// seed inserts these, and "Reset to default" in Settings restores them.

export type TemplateKey =
  "client_email" | "client_whatsapp" | "admin_email" | "admin_whatsapp"

export interface MessageTemplate {
  subject?: string
  body: string
}

export const DEFAULT_TEMPLATES: Record<TemplateKey, MessageTemplate> = {
  client_email: {
    subject: [
      "[[before]]Reminder: {domain} hosting renews on {renewal_date}",
      "[[today]]Today: {domain} hosting expires today",
      "[[after]]Action needed: {domain} hosting expired on {renewal_date}",
    ].join("\n"),
    body: `[[before]]
<p>Dear {client_name},</p>
<p>This is a friendly reminder that the hosting for <b>{domain}</b> will expire on <b>{renewal_date}</b> ({days_text}).</p>
<p>The yearly renewal charge is <b>{currency} {amount}</b>. Please arrange the payment before the expiry date so your website and emails keep running without interruption.</p>
<p>If you have already paid, please ignore this message.</p>
<p>Regards,<br>{business_name}<br>{business_phone}</p>
[[today]]
<p>Dear {client_name},</p>
<p>The hosting for <b>{domain}</b> <b>expires today ({renewal_date})</b>.</p>
<p>Please pay the renewal charge of <b>{currency} {amount}</b> today to avoid any interruption to your website.</p>
<p>Regards,<br>{business_name}<br>{business_phone}</p>
[[after]]
<p>Dear {client_name},</p>
<p>The hosting for <b>{domain}</b> expired on <b>{renewal_date}</b> ({days_text}).</p>
<p>To keep your website online, please pay the renewal charge of <b>{currency} {amount}</b> as soon as possible.</p>
<p>Regards,<br>{business_name}<br>{business_phone}</p>`,
  },

  client_whatsapp: {
    body: `[[before]]
Assalam-o-Alaikum {client_name},

Reminder: your website hosting for *{domain}* will expire on *{renewal_date}* ({days_text}).

Renewal charge: *{currency} {amount}*

Please renew before the expiry date so your website keeps running. If you have already paid, please ignore this message.

– {business_name}
[[today]]
Assalam-o-Alaikum {client_name},

Your hosting for *{domain}* *expires today* ({renewal_date}).
Renewal charge: *{currency} {amount}*

Please renew today to avoid interruption.

– {business_name}
[[after]]
Assalam-o-Alaikum {client_name},

Your hosting for *{domain}* expired on *{renewal_date}* ({days_text}).
Renewal charge: *{currency} {amount}*

Please renew as soon as possible to keep your website online.

– {business_name}`,
  },

  admin_email: {
    subject: "{count} hosting renewals need attention – {today}",
    body: `<p>Hi,</p>
<p>These hosting services are due for renewal:</p>
{summary_table}
<p>Open the dashboard to send reminders or record payments.</p>`,
  },

  admin_whatsapp: {
    body: `*Hosting renewals – {today}*
{count} services need attention:

{summary_list}

Open the dashboard to follow up.`,
  },
}
