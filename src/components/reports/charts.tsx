"use client";

/**
 * Reports charts — Recharts wrappers kept in one client module so the
 * Reports page itself can remain a single client component that composes them.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, formatMonth, formatNumber } from "./format";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CategoryDatum {
  category_id: string;
  name: string;
  color: string;
  total: number;
}

export interface CashflowDatum {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface AccountDatum {
  account_id: string;
  name: string;
  color: string;
  total: number;
}

/* -------------------------------------------------------------------------- */
/*  Expense by Category — Pie                                                  */
/* -------------------------------------------------------------------------- */

export function ExpenseByCategoryChart({
  data,
  baseCurrency,
}: {
  data: CategoryDatum[];
  baseCurrency: string;
}) {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={45}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.category_id} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              formatCurrency(Number(value), baseCurrency),
              "Amount",
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string, _entry, index) => {
              const datum = data[index];
              if (!datum) return value;
              const pct = total > 0 ? ((datum.total / total) * 100).toFixed(0) : "0";
              return `${value} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cashflow over time — grouped Bar                                           */
/* -------------------------------------------------------------------------- */

export function CashflowChart({
  data,
  baseCurrency,
}: {
  data: CashflowDatum[];
  baseCurrency: string;
}) {
  if (data.length === 0) return null;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m) => formatMonth(m)}
            tick={{ fontSize: 12, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatNumber(Number(v), 0)}
            tick={{ fontSize: 12, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value), baseCurrency),
              String(name),
            ]}
            labelFormatter={(label) => formatMonth(String(label))}
          />
          <Legend
            verticalAlign="top"
            height={28}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Spending by Account — horizontal Bar                                       */
/* -------------------------------------------------------------------------- */

export function SpendingByAccountChart({
  data,
  baseCurrency,
}: {
  data: AccountDatum[];
  baseCurrency: string;
}) {
  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatNumber(Number(v), 0)}
            tick={{ fontSize: 12, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip
            formatter={(value) => [
              formatCurrency(Number(value), baseCurrency),
              "Spent",
            ]}
          />
          <Bar dataKey="total" name="Spent" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.account_id} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
