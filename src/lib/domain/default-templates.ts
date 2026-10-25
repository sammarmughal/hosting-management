// Default message templates (docs/08 §2–§6). Single source of truth: the
// seed inserts these, and "Reset to default" in Settings restores them.

export type TemplateKey =
  | "client_email"
  | "client_whatsapp"
  | "admin_email"
  | "admin_whatsapp"
  | "invoice_email"
  | "invoice_whatsapp"

export interface MessageTemplate {
  subject?: string
  body: string
}

/** message_templates.subject is VARCHAR(190): every section together must fit. */
export const SUBJECT_MAX = 190

export const DEFAULT_TEMPLATES: Record<TemplateKey, MessageTemplate> = {
  // docs/14 §6: {{service_name}} is the catalog name ("Web Hosting"), and
  // {{company_line}} is " (Noor Dental Clinic)" or empty.
  client_email: {
    subject: [
      "[[before]]Reminder: {service_name} for {domain} renews on {renewal_date}",
      "[[today]]Today: {domain} expires today",
      "[[after]]Action needed: {domain} expired on {renewal_date}",
    ].join("\n"),
    body: `[[before]]
<p>Dear {client_name},</p>
<p>This is a friendly reminder that your {service_name} for <b>{domain}</b>{company_line} will expire on <b>{renewal_date}</b> ({days_text}).</p>
<p>The yearly renewal charge is <b>{currency} {amount}</b>. Please arrange the payment before the expiry date so everything keeps running without interruption.</p>
<p>If you have already paid, please ignore this message.</p>
<p>Regards,<br>{business_name}<br>{business_phone}</p>
[[today]]
<p>Dear {client_name},</p>
<p>Your {service_name} for <b>{domain}</b>{company_line} <b>expires today ({renewal_date})</b>.</p>
<p>Please pay the renewal charge of <b>{currency} {amount}</b> today to avoid any interruption.</p>
<p>Regards,<br>{business_name}<br>{business_phone}</p>
[[after]]
<p>Dear {client_name},</p>
<p>Your {service_name} for <b>{domain}</b>{company_line} expired on <b>{renewal_date}</b> ({days_text}).</p>
<p>To keep it running, please pay the renewal charge of <b>{currency} {amount}</b> as soon as possible.</p>
<p>Regards,<br>{business_name}<br>{business_phone}</p>`,
  },

  client_whatsapp: {
    body: `[[before]]
Assalam-o-Alaikum {client_name},

Reminder: your {service_name} for *{domain}*{company_line} will expire on *{renewal_date}* ({days_text}).

Renewal charge: *{currency} {amount}*

Please renew before the expiry date so everything keeps running. If you have already paid, please ignore this message.

– {business_name}
[[today]]
Assalam-o-Alaikum {client_name},

Your {service_name} for *{domain}*{company_line} *expires today* ({renewal_date}).
Renewal charge: *{currency} {amount}*

Please renew today to avoid interruption.

– {business_name}
[[after]]
Assalam-o-Alaikum {client_name},

Your {service_name} for *{domain}*{company_line} expired on *{renewal_date}* ({days_text}).
Renewal charge: *{currency} {amount}*

Please renew as soon as possible to keep it running.

– {business_name}`,
  },

  admin_email: {
    subject: "{count} renewals need attention – {today}",
    body: `<p>Hi,</p>
<p>These subscriptions are due for renewal:</p>
{summary_table}
<p>Open the dashboard to send reminders or record payments.</p>`,
  },

  admin_whatsapp: {
    body: `*Renewals – {today}*
{count} subscriptions need attention:

{summary_list}

Open the dashboard to follow up.`,
  },

  // docs/13 §9–§10: the "Invoice" template, used by Share invoice.
  invoice_email: {
    subject: "Invoice {{invoice_number}} for {domain}",
    body: `<p>Dear {client_name},</p>
<p>Please find attached invoice <b>{{invoice_number}}</b> for the {{service_name}} renewal of <b>{domain}</b>{{company_line}}.</p>
<p>Amount due: <b>{{invoice_total}}</b><br>Due date: <b>{{due_date}}</b></p>
{{payment_details}}
<p>You can also view and download it online: <a href="{{invoice_link}}">{{invoice_link}}</a></p>
<p>Regards,<br>{business_name}<br>{business_phone}</p>`,
  },

  invoice_whatsapp: {
    body: `Assalam-o-Alaikum {client_name},

Your invoice *{{invoice_number}}* for {{service_name}} – *{domain}*{{company_line}} is ready.
Amount: *{{invoice_total}}*
Due date: *{{due_date}}*

View or download: {{invoice_link}}

– {business_name}`,
  },
}
