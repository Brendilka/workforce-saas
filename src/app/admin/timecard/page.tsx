import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const employeeMeta = [
  ["Home Business Structure", "Home Business Structure"],
  ["Company", "ABC"],
  ["Division", "SEAA"],
  ["State", "NSW"],
  ["Location", "Sydney"],
  ["Employee", "John Smith"],
  ["Employee ID", "1200546"],
  ["Position No", "564768"],
  ["Operations", "Support"],
  ["Area", "Head Office"],
  ["Department", "Finance"],
  ["Sub Department", "Payroll"],
  ["Cost Centre", "700541"],
  ["Job - Grade", "Snr Pay Clerk 4"],
] as const;

const weekColumns = [
  "Mon 10/03/25",
  "Tue 11/03/25",
  "Wed 12/03/25",
  "Thu 13/03/25",
  "Fri 14/03/25",
  "Sat 15/03/25",
  "Sun 16/03/25",
];

const scheduleRows = [
  {
    label: "Schedule",
    values: ["09:00 - 17:06", "09:00 - 17:06", "09:00 - 17:06", "09:00 - 17:06", "09:00 - 17:06", "Not Rostered", "Not Rostered"],
    variant: "schedule",
  },
  {
    label: "Shift Hours (Minutes)",
    values: ["8:06", "8:06", "8:06", "8:06", "8:06", "", ""],
  },
  {
    label: "Actual Shift Punches",
    values: ["08:58 - 17:04", "08:59 - 18:30", "09:00 - 14:30", "08:57", "8:06", "10:00 - 14:00", "Not Rostered"],
  },
  {
    label: "Unpaid Meal Break",
    values: [":30", ":30", ":30", ":30", "", "", ""],
  },
  {
    label: "Worked Hrs (Minutes)",
    values: ["7:36", "8:06", "5:36", "", "", "4:00", ""],
  },
  {
    label: "Leave",
    values: ["", "", "Sick", "", "Annual Leave", "", ""],
  },
  {
    label: "Live Hrs/Part duration",
    values: ["", "", "14:30 2.60", "", "7:36", "", ""],
  },
  {
    label: "Higher Duties",
    values: ["Grade 5", "", "", "", "", "", ""],
  },
  {
    label: "Full Day Cost Transfer",
    values: ["", "700600", "", "", "", "", ""],
  },
  {
    label: "Multiple CC Job Trsf +",
    values: ["", "", "", "", "", "", ""],
  },
  {
    label: "Exceptions",
    values: ["", "Overtime", "", "No Punch Out", "", "", ""],
    variant: "exceptions",
  },
] as const;

const payCodeRows = [
  {
    label: "Pay Code",
    values: ["Ord001", "Ord001", "Ord001", "", "AL03", "OT1.5", ""],
  },
  {
    label: "Decimal Hours / Unit / $",
    values: ["7.60", "7.60", "5.00", "", "7.60", "3.00", ""],
  },
  {
    label: "Pay Code",
    values: ["", "", "Sick", "", "", "OT2.0", ""],
  },
  {
    label: "Decimal Hours / Unit / $",
    values: ["", "", "2.6", "", "", "1.00", ""],
  },
  {
    label: "Pay Code",
    values: ["", "", "", "", "", "Tea Money", ""],
  },
  {
    label: "Decimal Hours / Unit / $",
    values: ["", "", "", "", "", "1", ""],
  },
  {
    label: "Pay Code + Continued or Added",
    values: ["", "", "", "", "", "", ""],
  },
] as const;

const totalsSummary = [
  ["Ord Shift hrs", "38"],
  ["Actual", "30.40"],
  ["Unallocated", "7.60"],
] as const;

const totalsSections = [
  {
    title: "Ordinary",
    rows: [
      ["Pay Code", "Ord001", "12.60", "$100.00", "", "Grade 5"],
      ["Pay Code", "Ord001", "7.60", "$100.00", "700600", ""],
      ["Pay Code", "Unallocated", "7.60", "", "", ""],
    ],
  },
  {
    title: "Shift Penalty",
    rows: [],
  },
  {
    title: "Overtime",
    rows: [
      ["Pay Code", "OT1.5", "3.0", "$450.00", "", ""],
      ["Pay Code", "OT2.0", "1.0", "$200.00", "", ""],
    ],
  },
  {
    title: "Allowances",
    rows: [["Pay Code", "TM01", "1", "$22.30", "", ""]],
  },
  {
    title: "Leave",
    rows: [
      ["Leave Code", "AL03", "7.6", "$100.00", "", ""],
      ["Leave Code", "Sick Paid", "2.6", "$26.32", "", ""],
    ],
  },
] as const;

function cellClass(variant?: string, value?: string) {
  if (variant === "schedule") {
    return "bg-[#fff6bf] font-semibold";
  }

  if (variant === "exceptions" && value === "Overtime") {
    return "bg-[#7bc64c] text-[#12330b] font-semibold";
  }

  if (variant === "exceptions" && value === "No Punch Out") {
    return "bg-[#ef4444] text-white font-semibold";
  }

  if (value === "Not Rostered") {
    return "bg-gray-100 text-gray-500 font-medium";
  }

  return "";
}

export default async function AdminTimecardPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user) {
    redirect("/login");
  }

  if (role !== "admin") {
    redirect(`/${role}/dashboard`);
  }

  const userName = user.user_metadata?.full_name || user.email || "Admin";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout
      userRole="admin"
      userName={userName}
      userInitials={userInitials}
    >
      <PageHeader
        title="Timecard"
        description="Employee timecard schedule versus actual view"
      />

      <div className="rounded-2xl border border-gray-300 bg-[#f7f7f4] p-4 shadow-sm">
        <h2 className="mb-4 text-[28px] font-semibold tracking-tight text-[#3c6f96]">
          Employee Timecard - Schedule Vs. Actual
        </h2>

        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {employeeMeta.map(([label, value]) => (
            <div key={label} className="border border-gray-400 bg-white">
              <div className="border-b border-gray-300 bg-[#e7e7e1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                {label}
              </div>
              <div className="px-2 py-1.5 text-xs font-medium text-gray-800">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="font-semibold text-gray-700">
            Date Selection <span className="font-normal text-gray-500">Current Pay Period 10/03/25</span>
          </div>
          <div className="font-semibold text-red-600">Exceptions to fix</div>
          <Badge className="rounded-sm bg-red-700 px-2 py-0.5 text-[10px] text-white hover:bg-red-700">1</Badge>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="text-gray-600">Approve</div>
            <div className="text-gray-600">Sign-Off</div>
            <div className="font-semibold text-red-700">Timecard Status</div>
            <Badge className="rounded-sm bg-[#d6402b] px-2 py-0.5 text-[10px] text-white hover:bg-[#d6402b]">
              Pending
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] border-collapse border border-gray-500 bg-white text-[11px]">
              <thead>
                <tr className="bg-[#4977a5] text-white">
                  <th className="border border-gray-500 px-2 py-1 text-left font-semibold">Date</th>
                  {weekColumns.map((column) => (
                    <th key={column} className="border border-gray-500 px-2 py-1 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-gray-500 bg-[#f1f1ec] px-2 py-1 font-semibold text-gray-700">
                      {row.label}
                    </td>
                    {row.values.map((value, index) => (
                      <td
                        key={`${row.label}-${index}`}
                        className={cn(
                          "border border-gray-500 px-2 py-1 text-center text-gray-800",
                          cellClass(row.variant, value)
                        )}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="bg-[#efefea]">
                  <td className="border border-gray-500 px-2 py-1 font-semibold text-gray-700"> </td>
                  {weekColumns.map((_, index) => (
                    <td key={`daily-${index}`} className="border border-gray-500 px-2 py-1 text-center font-semibold text-gray-700">
                      Daily
                    </td>
                  ))}
                </tr>

                {payCodeRows.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-gray-500 bg-[#f8f8f5] px-2 py-1 font-semibold text-[#4e6887]">
                      {row.label}
                    </td>
                    {row.values.map((value, index) => (
                      <td key={`${row.label}-pay-${index}`} className="border border-gray-500 px-2 py-1 text-center">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[460px] border-collapse border border-gray-500 bg-white text-[11px]">
              <thead>
                <tr>
                  <th colSpan={6} className="border border-gray-500 bg-[#efefea] px-2 py-2 text-center text-sm font-semibold text-gray-700">
                    Pay Period To Date Totals (In Decimal)
                  </th>
                </tr>
                <tr className="bg-[#c92d25] text-white">
                  {totalsSummary.map(([label, value]) => (
                    <th key={label} className="border border-gray-500 px-2 py-1 text-left">
                      <div className="text-[10px] font-semibold uppercase">{label}</div>
                      <div className="text-xs">{value}</div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-[#efefea] text-gray-700">
                  <th className="border border-gray-500 px-2 py-1 text-left">Pay Type</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Pay Code</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Hours</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">$ Amount</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Cost Area</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Activity</th>
                </tr>
              </thead>
              <tbody>
                {totalsSections.map((section) => (
                  <Fragment key={section.title}>
                    <tr>
                      <td className="border border-gray-500 bg-[#f8f8f5] px-2 py-1 font-semibold text-gray-700">
                        {section.title}
                      </td>
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                    </tr>
                    {section.rows.length === 0 ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={`${section.title}-blank-${index}`}>
                          <td className="border border-gray-500 px-2 py-1 text-gray-500">Pay Code</td>
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                        </tr>
                      ))
                    ) : (
                      section.rows.map((row, rowIndex) => (
                        <tr key={`${section.title}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${section.title}-${rowIndex}-${cellIndex}`} className="border border-gray-500 px-2 py-1">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
          Hover and drill-down interactions can be added later. This admin view currently mirrors the reference layout with
          a schedule-versus-actual grid on the left and pay-period totals on the right.
        </p>
      </div>
    </DashboardLayout>
  );
}
