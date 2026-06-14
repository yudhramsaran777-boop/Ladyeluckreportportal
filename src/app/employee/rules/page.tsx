import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const RULE_SECTIONS = [
  {
    title: "Shift Reporting",
    items: [
      "Start your shift report at the beginning of every shift before handling any transactions.",
      "Record opening coins, admin added coins, and starting coins after add accurately for every game you operate.",
      "Enter ending coins at the close of your shift for every game, even if there was no activity.",
      "Submit your shift report before you leave — unsubmitted shifts may delay payroll and reconciliation.",
    ],
  },
  {
    title: "Redeems / Cashouts",
    items: [
      "Verify the customer's Facebook name and game username before processing a redeem.",
      "Always select the correct payment method and enter the correct CashTag, ChimeTag, or payment info.",
      "Record which Facebook page the customer reached out from for every redeem.",
      "Double-check the redeem amount before submitting — edits should only be used to correct genuine mistakes.",
    ],
  },
  {
    title: "Payment Accounts",
    items: [
      "Only use CashApp and Chime accounts that are marked Active.",
      "Never share CashApp, Chime, or game account credentials outside of this portal.",
      "Report any payment account issues (limits reached, login problems) to your manager immediately.",
    ],
  },
  {
    title: "General Conduct",
    items: [
      "Keep all customer and account information confidential.",
      "Do not modify game settings, cost percentages, or other employees' records.",
      "Contact your manager or owner with any questions about shift procedures or this portal.",
    ],
  },
];

export default function EmployeeRulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Rules" showDateFilter={false} />
      <div className="space-y-4">
        {RULE_SECTIONS.map((section) => (
          <div key={section.title} className="card-panel p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">{section.title}</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-emerald-100/80">
              {section.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
