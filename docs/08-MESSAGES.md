# 08 — Messages: Email & WhatsApp

## 1. Placeholders

| Placeholder | Example | Available in |
|-------------|---------|--------------|
| `{client_name}` | Ali Khan | client templates |
| `{company}` | Khan Traders | client templates |
| `{domain}` | clientb.pk | client templates |
| `{renewal_date}` | 30 Sep 2026 | client templates |
| `{days_left}` | 7 | client templates (absolute number) |
| `{days_text}` | "in 7 days" / "today" / "3 days ago" | client templates |
| `{amount}` | 6,500 | client templates (formatted, no decimals if .00) |
| `{currency}` | PKR | client templates |
| `{business_name}` | Our Hosting | all |
| `{business_phone}` | +92 300 1234567 | all |
| `{summary_table}` | HTML table | admin email only |
| `{summary_list}` | plain-text list | admin WhatsApp only |
| `{count}` | 7 | admin templates |
| `{today}` | 25 Sep 2026 | all |

Rendering (`renderTemplate()` in `src/lib/domain/templates.ts`): a simple `replace(/\{(\w+)\}/g, …)` with the map above. Unknown placeholders are left as they are. In **HTML** emails every value is HTML-escaped with `escapeHtml()` (except `{summary_table}`, which is built safely by the code). In **WhatsApp** the values are plain text.

Templates choose the wording based on `days_left`, using **three variants per client template**, chosen automatically:
- `before`: days_left > 0
- `today`: days_left = 0
- `after`: days_left < 0

To keep it simple, store them as three sections in one body, separated by the markers `[[before]]`, `[[today]]` and `[[after]]`. The renderer picks the matching section.

## 2. Client email (default)

**Subject**
```
[[before]]Reminder: {domain} hosting renews on {renewal_date}
[[today]]Today: {domain} hosting expires today
[[after]]Action needed: {domain} hosting expired on {renewal_date}
```

**Body (HTML)**
```
[[before]]
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
<p>Regards,<br>{business_name}<br>{business_phone}</p>
```

Email wrapper (added by code around the body): a 600 px wide card, the business name header in `--brand-700`, the body, and a small grey footer "This is an automated reminder from {business_name}". Inline CSS only (email clients). Always send a **plain-text alternative** (strip the tags).

## 3. Client WhatsApp (default)

Keep it short. WhatsApp formatting: `*bold*`, `_italic_`.
```
[[before]]
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

– {business_name}
```

## 4. Phone normalisation (`normalisePhone()` in `src/lib/domain/whatsapp.ts`)

The goal is digits only, with the country code and no `+`, which is what `wa.me` requires.

```
input  → strip spaces, dashes, brackets, dots
"+923001234567"  → "923001234567"
"00923001234567" → "923001234567"
"03001234567"    → "923001234567"   (leading 0 + 10 digits → assume Pakistan +92)
"3001234567"     → "923001234567"   (10 digits starting with 3 → Pakistan mobile)
"+971501234567"  → "971501234567"   (other countries kept as-is when + or 00 present)
anything else not 10–15 digits after cleanup → null (invalid)
```
- The default country code (`92`) is a constant. It could become a setting later.
- Display format: `+92 300 1234567`.
- Link: `https://wa.me/923001234567?text=` + `encodeURIComponent(message)`.
- Keep the message under about 1,500 characters, because very long URLs can fail on some phones.

## 5. Admin summary

### 5.1 Admin email
**Subject:** `{count} hosting renewals need attention – {today}`

**Body:**
```html
<p>Hi,</p>
<p>These hosting services are due for renewal:</p>
{summary_table}
<p>Open the dashboard to send reminders or record payments.</p>
```
`{summary_table}` columns: Domain · Client · Phone · Renewal date · Days left (coloured text) · Amount. Sorted most urgent first, plus a **total expected** row per currency.

### 5.2 Admin WhatsApp (sent to the admin's own number)
```
*Hosting renewals – {today}*
{count} services need attention:

{summary_list}

Open the dashboard to follow up.
```
`{summary_list}` has one line per service:
```
🔴 clientb.pk – Client B – 2 days – PKR 6,500
🟠 clientc.com – Client C – 17 days – PKR 10,000
⚫ clienta.com – Client A – expired 4 days ago – PKR 8,000
```

## 6. Default templates

Insert four rows into `message_templates` with the keys `client_email` (subject + body), `client_whatsapp` (body), `admin_email` (subject + body) and `admin_whatsapp` (body), using the texts above. "Reset to default" in Settings re-inserts these texts, so keep them in `src/lib/domain/default-templates.ts` as the single source of truth. `prisma/seed.ts` inserts them on install.

## 7. SMTP on Hostinger

- Create a mailbox such as `billing@ourdomain.com` in hPanel → Emails.
- Typical values: host `smtp.hostinger.com`, port `465` with SSL (or `587` with TLS). Username = the full email address, password = the mailbox password. **Confirm these in hPanel → Emails → Configuration**, since values can change.
- Set SPF, DKIM and DMARC for the domain (in hPanel, usually automatic for Hostinger email) so the reminders don't land in spam.
- Hostinger limits how many emails can be sent per day depending on the plan. Check the plan's limit. The batch-size setting and one-by-one sending keep us well within it for normal volumes.
- Nodemailer: `createTransport({ host, port, secure: port === 465, auth, connectionTimeout: 15000 })`, and send with `html`, `text` (plain alternative) and `replyTo: admin_email`. Create the transport per request (serverless), not as a long-lived global.
