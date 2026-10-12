import "server-only"

import path from "node:path"

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import { formatDatePK } from "@/lib/domain/dates"
import { hasPaymentInstructions, INVOICE_STATUS_LABEL } from "@/lib/domain/invoices"
import { formatAmount, formatMoney, toUnits } from "@/lib/domain/money"
import { formatPhone } from "@/lib/domain/whatsapp"
import type { InvoiceDocumentData } from "@/types/view"

// docs/13 §7: A4, Geist TTF, the same layout as the HTML preview, docs/12
// visuals (neutral, hairlines, brand only for the title, money right-aligned
// and tabular, no emoji). Generated on demand; nothing is stored on disk.

const FONTS = path.join(process.cwd(), "src", "assets", "fonts")
let registered = false
function registerFonts() {
  if (registered) return
  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(FONTS, "Geist-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS, "Geist-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONTS, "Geist-SemiBold.ttf"), fontWeight: 600 },
    ],
  })
  Font.register({
    family: "GeistMono",
    fonts: [
      { src: path.join(FONTS, "GeistMono-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS, "GeistMono-Medium.ttf"), fontWeight: 500 },
    ],
  })
  // Never hyphenate words (domains, names).
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}

// docs/12 §3 tokens.
const C = {
  ink: "#111827",
  muted: "#6B7280",
  line: "#E6E8EC",
  subtle: "#F3F4F6",
  brand: "#1F4E79",
  green: "#177A45",
  red: "#B42323",
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Geist",
    fontSize: 9.5,
    color: C.ink,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },
  header: { flexDirection: "row", justifyContent: "space-between" },
  seller: { width: "55%", paddingRight: 16 },
  // Left-aligned with the text below (contain alone centres it in its box).
  logo: { height: 34, maxWidth: 140, objectFit: "contain", objectPositionX: 0, marginBottom: 10 },
  sellerName: { fontSize: 11, fontWeight: 600 },
  // No logo: the business name is the logo (14.5 pt ≈ 19 px), tagline under it.
  wordmark: { fontSize: 14.5, lineHeight: 1.25, fontWeight: 600, color: C.ink, letterSpacing: -0.15 },
  tagline: { fontSize: 9.5, lineHeight: 1.35, color: C.muted, marginTop: 2 },
  wordmarkBlock: { marginBottom: 8 },
  muted: { color: C.muted },
  right: { width: "45%", alignItems: "flex-end" },
  // Explicit line heights: the page's 1.4 multiplier gave the 20 pt title a
  // line box that the number below overlapped.
  title: { fontSize: 20, lineHeight: 1.3, fontWeight: 600, color: C.brand, letterSpacing: -0.2 },
  number: { fontFamily: "GeistMono", fontSize: 10, lineHeight: 1.3, marginTop: 4 },
  metaRow: { flexDirection: "row", marginTop: 3 },
  metaLabel: { color: C.muted, width: 62, textAlign: "right", marginRight: 10 },
  metaValue: { minWidth: 70, textAlign: "right" },
  status: { marginTop: 8, fontSize: 9, fontWeight: 500 },
  section: { marginTop: 26, paddingTop: 14, borderTopWidth: 0.75, borderTopColor: C.line },
  label: { fontSize: 8.5, color: C.muted, fontWeight: 500, marginBottom: 3 },
  // Leaves the right side free for the "Paid on" mark, so long names wrap
  // instead of running under it.
  billBlock: { width: "62%" },
  billName: { fontSize: 10.5, fontWeight: 500 },
  table: { marginTop: 26 },
  th: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: C.line,
    paddingBottom: 5,
    fontSize: 8.5,
    color: C.muted,
    fontWeight: 500,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: C.line,
    paddingVertical: 8,
  },
  cDesc: { flexGrow: 1, flexBasis: 0, paddingRight: 10 },
  cPeriod: { width: 150, paddingRight: 10, color: C.muted },
  cQty: { width: 30, textAlign: "right" },
  cAmt: { width: 100, textAlign: "right" },
  money: { fontFamily: "GeistMono" },
  totals: { marginTop: 12, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 0.75,
    borderTopColor: C.line,
    fontSize: 11,
    fontWeight: 600,
  },
  pay: {
    marginTop: 26,
    padding: 12,
    backgroundColor: C.subtle,
    borderRadius: 4,
  },
  payTitle: { fontWeight: 500, marginBottom: 5 },
  payRow: { flexDirection: "row", marginTop: 2 },
  payLabel: { width: 120, color: C.muted },
  payValue: { flexGrow: 1, flexBasis: 0, fontFamily: "GeistMono" },
  footer: { marginTop: 18, color: C.muted },
  paidMark: {
    position: "absolute",
    top: 200,
    right: 48,
    borderWidth: 1.25,
    borderColor: C.green,
    borderRadius: 4,
    color: C.green,
    paddingVertical: 5,
    paddingHorizontal: 9,
    fontSize: 10,
    fontWeight: 600,
    transform: "rotate(-6deg)",
  },
  pageNo: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: C.muted,
    flexDirection: "row",
    justifyContent: "space-between",
  },
})

const statusColour = (status: InvoiceDocumentData["status"]) =>
  status === "paid" ? C.green : status === "overdue" ? C.red : C.muted

export function InvoicePdf({ invoice: inv }: { invoice: InvoiceDocumentData }) {
  const seller = inv.seller
  const bill = inv.billTo
  const hasDiscount = toUnits(inv.discount) > 0n
  const hasTax = toUnits(inv.taxAmount) > 0n
  const payRows = (
    [
      ["Bank", seller.payment.bankName],
      ["Account title", seller.payment.accountTitle],
      ["Account / IBAN", seller.payment.accountNumber],
      ["JazzCash / Easypaisa", seller.payment.wallet],
    ] as const
  ).filter(([, v]) => v.trim() !== "")

  return (
    <Document
      title={`Invoice ${inv.number}`}
      author={seller.businessName}
      subject={`Invoice ${inv.number} for ${bill.name}`}
      creator="Renewals"
      producer="Renewals"
    >
      <Page size="A4" style={s.page}>
        {/* 1. Seller | title, number, dates, status */}
        <View style={s.header}>
          <View style={s.seller}>
            {seller.logo ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                <Image src={seller.logo} style={s.logo} />
                <Text style={s.sellerName}>{seller.businessName}</Text>
              </>
            ) : (
              <View style={s.wordmarkBlock}>
                <Text style={s.wordmark}>{seller.businessName}</Text>
                {seller.tagline ? <Text style={s.tagline}>{seller.tagline}</Text> : null}
              </View>
            )}
            {seller.address ? <Text style={s.muted}>{seller.address}</Text> : null}
            {seller.phone ? <Text style={s.muted}>{seller.phone}</Text> : null}
            {seller.email ? <Text style={s.muted}>{seller.email}</Text> : null}
            {seller.ntn ? <Text style={s.muted}>NTN {seller.ntn}</Text> : null}
          </View>
          <View style={s.right}>
            <Text style={s.title}>Invoice</Text>
            <Text style={s.number}>{inv.number}</Text>
            <View style={[s.metaRow, { marginTop: 10 }]}>
              <Text style={s.metaLabel}>Issue date</Text>
              <Text style={s.metaValue}>{formatDatePK(inv.issueDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Due date</Text>
              <Text style={s.metaValue}>{formatDatePK(inv.dueDate)}</Text>
            </View>
            <Text style={[s.status, { color: statusColour(inv.status) }]}>
              {INVOICE_STATUS_LABEL[inv.status]}
            </Text>
          </View>
        </View>

        {/* 2. Bill to */}
        <View style={s.section}>
          <View style={s.billBlock}>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.billName}>{bill.name}</Text>
            {bill.company ? <Text style={s.muted}>{bill.company}</Text> : null}
            {bill.email ? <Text style={s.muted}>{bill.email}</Text> : null}
            {bill.phone ? <Text style={s.muted}>{formatPhone(bill.phone)}</Text> : null}
            {bill.address ? <Text style={s.muted}>{bill.address}</Text> : null}
          </View>
        </View>

        {/* 3. Items */}
        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={s.cDesc}>Description</Text>
            <Text style={[s.cPeriod, { color: C.muted }]}>Period</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cAmt}>Amount</Text>
          </View>
          {inv.items.map((it) => (
            <View key={it.id} style={s.tr} wrap={false}>
              <Text style={s.cDesc}>{it.description}</Text>
              <Text style={s.cPeriod}>{it.periodLabel}</Text>
              <Text style={s.cQty}>{it.quantity}</Text>
              <Text style={[s.cAmt, s.money]}>{formatMoney(it.amount, inv.currency)}</Text>
            </View>
          ))}

          {/* 4. Totals */}
          <View style={s.totals} wrap={false}>
            <View style={s.totalRow}>
              <Text style={s.muted}>Subtotal</Text>
              <Text style={s.money}>{formatAmount(inv.subtotal, inv.currency)}</Text>
            </View>
            {hasDiscount ? (
              <View style={s.totalRow}>
                <Text style={s.muted}>Discount</Text>
                <Text style={s.money}>−{formatAmount(inv.discount, inv.currency)}</Text>
              </View>
            ) : null}
            {hasTax ? (
              <View style={s.totalRow}>
                <Text style={s.muted}>Tax ({formatAmount(inv.taxRate)}%)</Text>
                <Text style={s.money}>{formatAmount(inv.taxAmount, inv.currency)}</Text>
              </View>
            ) : null}
            <View style={s.grand}>
              <Text>Total</Text>
              <Text style={[s.money, { fontWeight: 500 }]}>{formatMoney(inv.total, inv.currency)}</Text>
            </View>
          </View>
        </View>

        {/* 5. Payment instructions */}
        {hasPaymentInstructions(seller) ? (
          <View style={s.pay} wrap={false}>
            <Text style={s.payTitle}>Payment instructions</Text>
            {payRows.map(([label, value]) => (
              <View key={label} style={s.payRow}>
                <Text style={s.payLabel}>{label}</Text>
                <Text style={s.payValue}>{value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 6. Footer note */}
        {inv.notes || seller.footer ? (
          <View style={s.footer} wrap={false}>
            {inv.notes ? <Text>{inv.notes}</Text> : null}
            {seller.footer ? <Text>{seller.footer}</Text> : null}
          </View>
        ) : null}

        {/* Paid mark (docs/13 §5) */}
        {inv.status === "paid" && inv.paidAt ? (
          <Text style={s.paidMark} fixed>
            Paid on {formatDatePK(inv.paidAt)}
          </Text>
        ) : null}

        <View style={s.pageNo} fixed>
          <Text>{inv.number}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(invoice: InvoiceDocumentData): Promise<Buffer> {
  registerFonts()
  return renderToBuffer(<InvoicePdf invoice={invoice} />)
}
