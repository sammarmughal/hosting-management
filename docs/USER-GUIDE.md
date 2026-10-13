# Owner's guide — Hosting Renewal Manager

This guide is for the person who uses the app every day. It explains the main jobs in simple steps.

Open the app at **https://renewals.abdulrehmaan.net**. Sign in with your username, your password, and the 6-digit code from the authenticator app on your phone.

---

## 1. Your daily routine (5 minutes)

The app checks every morning at 9:00 by itself. It finds services that renew soon, gets reminders ready and creates invoices. Nothing is sent to clients until you press a button.

1. **Open the Dashboard.** The numbers at the top show how many services are active, renewing soon and expired, and how much money is expected in the next 30 days (one total for each currency).
2. **Look at "Reminders due".** Each row is one client whose hosting renews soon.
3. **Press "Send emails".** All waiting reminder emails go out, one by one. You can see the progress. Each email has the invoice attached as a PDF.
4. **Press "WhatsApp queue".** WhatsApp opens with the message already written, one client at a time. Press **Send** inside WhatsApp, come back to the app and press **Mark sent and next**. (On a single reminder the button is **Mark as sent**.) Only mark it sent after you really sent the message.
5. **Check "Due soon"** to see which renewals are coming up next.

If you want to check again during the day, press **Check now** on the Dashboard.

**Once a week:** go to **Settings → Backup** and download the four CSV files (Clients, Services, Payments, Invoices). Save them in a new folder in Google Drive, for example `Renewals backup 2026-10-12`.

---

## 2. Adding a new client

1. Go to **Clients** and press **Add client** (on the phone, the round **+** button).
2. Fill in **Client details**:
   - **Name** (required).
   - **Email** and/or **WhatsApp phone**. Add at least one, so reminders can reach the client.
     - Pakistani numbers can be typed as `0300 1234567`.
     - Numbers from other countries need the country code, for example **`+971 54 775 7581`** for the UAE. A green tick under the field means the number is correct.
   - **Address** (optional). It is printed on invoices.
   - **Currency**: the currency this client pays in, for example **PKR** for a Pakistani client or **AED** for a UAE client. New services and invoices for this client use it.
3. Fill in **Hosting service**:
   - **Domain**, for example `noordental.pk`.
   - **Start date**. The **renewal date** is set to one year later by itself; you can change it.
   - **Yearly charge** and its currency (it follows the client's currency; you can change it for one service).
   - Leave **Send reminders** on.
4. Press **Save client**.

To add another website for the same client, open the client and press **Add service**.

**Need a currency that is not in the list?** Go to **Settings → Business → Currencies**, press **Add currency**, type the name (for example "Saudi") and pick it. Press **Save business**.

---

## 3. Sharing an invoice

Invoices are made by themselves 30 days before each renewal (you can change this in **Settings → Invoices**). You can also make one at any time with **Create invoice now** on a service.

To send an invoice:

1. Open the invoice: **Invoices** in the menu, or the invoice number on the client's service.
2. Press **Share invoice**.
3. Choose **Email** or **WhatsApp**. The client's email address or WhatsApp number is filled in for you.
   - **Email** sends the invoice with the PDF attached. Press **Send email**.
   - **WhatsApp** opens WhatsApp with a message and a safe link to the invoice. Press **Send** inside WhatsApp.
4. You can also press **Download PDF** to save it, or **Copy link** to paste the link anywhere.

The client can open the link on their phone without logging in, see the invoice and download the PDF.

**Which bank details are on the invoice?** It depends on the invoice's currency. In **Settings → Invoices → Payment accounts**, each bank account lists the currencies it's for, for example PKR on the Pakistan account and AED on the UAE account. The account marked **Default** is used for every other currency. If you change your bank details later, press **Refresh business details** on an unpaid invoice to update it. Paid invoices never change.

---

## 4. Marking an invoice as paid

When the client pays:

1. Open the invoice and press **Mark as paid**. (Or press **Record renewal** on the client's service. It does the same thing.)
2. Check the **amount** (it is filled in from the invoice), the **date paid** and **how it was paid** (cash, bank transfer, JazzCash, Easypaisa, other). Add a reference if you have one.
3. Press **Renew until …**.

The app records the payment, moves the renewal date one year ahead, and marks the invoice **Paid**. The payment appears under **Payments**.

---

## 5. What the colours mean

Every service shows a colour and a live countdown to its renewal date.

| Colour | Label | Meaning | What to do |
|--------|-------|---------|------------|
| **Green** | Active | More than 30 days left | Nothing. |
| **Orange** | Expiring soon | 8 to 30 days left | Reminders start. Send them from the Dashboard. |
| **Red** | Expiring soon | 7 days or less left | Call or message the client if they haven't paid. |
| **Dark red** | Expired | The renewal date has passed | Follow up today. Renew it when they pay, or cancel the service if they have left. |

Invoices have their own labels: **Unpaid**, **Sent**, **Overdue** (the due date has passed and it is not paid), **Paid** and **Void** (cancelled).

You can change the 30-day and 7-day limits in **Settings → Reminders**.

---

## 6. If an email fails

Sometimes an email can't be sent, for example because the address has a mistake or the email account has a problem.

1. On the Dashboard, the reminder shows a red **Failed** label. Move the mouse over it (or tap it) to see the reason.
2. Fix the cause:
   - **Wrong or old email address:** open the client, press **Edit**, correct the email and save.
   - **The client's mailbox is full or rejects mail:** send the reminder by **WhatsApp** instead.
   - **Every email fails** (for example "authentication failed" or "connection timed out"): the email settings have a problem. Go to **Settings → Email** and press **Send test email**. If it fails, check the email password in Hostinger (hPanel → Emails) and enter it again in **Settings → Email**.
3. Press **Retry** next to **Failed** to send it again.

Failed emails also appear in the bell (notifications), in the client's **Reminder log**, and in the invoice's history. Nothing is lost: the reminder waits until it is sent or skipped.

---

## 7. Good to know

- **Signing in with Google:** on the sign-in page, press **Sign in with Google** and choose your Google account (abdulrehmaan060@gmail.com). You don't need the 6-digit code from the authenticator app then: your Google account protects the sign-in instead. **So keep 2-Step Verification turned on for your Google account:** go to https://myaccount.google.com/security → **2-Step Verification**. Other Google accounts can't sign in; they just see "Invalid credentials.".

- **Bell icon:** news from the app (new invoices, expiring services, failed emails). Press **Mark all read** when you have seen them.
- **Search:** the search box at the top finds clients by name, company, email, phone or domain.
- **Cancelled client?** On the service, press **⋯ → Cancel service**. It gets no more reminders or invoices. You can reactivate it later.
- **Lost your phone (2-step code)?** Use one of the recovery codes you saved when you first signed in. If you have none left, ask the developer to reset two-step verification.
- **Something looks wrong?** Take a screenshot and send it to the developer, with the client name and what you pressed.
