"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Transaction } from "@/hooks/use-earnings-data";

// ---------------------------------------------------------------------------
// Pagination constant
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 10;

// ---------------------------------------------------------------------------
// Transaction styling helpers (module-private)
// ---------------------------------------------------------------------------

function txTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sale: "Sale",
    escrow_release: "Escrow Release",
    platform_fee: "Platform Fee",
    withdrawal: "Withdrawal",
    refund: "Refund",
    deposit: "Deposit",
    purchase: "Purchase",
  };
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function txTypeColor(type: string): string {
  switch (type) {
    case "sale":
    case "escrow_release":
      return "text-gain";
    case "platform_fee":
      return "text-loss";
    case "withdrawal":
      return "text-blue-400";
    case "refund":
      return "text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function txStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
    case "completed":
      return (
        <Badge variant="secondary" className="bg-gain/10 text-gain border-gain/20">
          Confirmed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="secondary" className="bg-loss/10 text-loss border-loss/20">
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {status}
        </Badge>
      );
  }
}

function txAmountPrefix(type: string): string {
  switch (type) {
    case "sale":
    case "escrow_release":
    case "refund":
    case "deposit":
      return "+";
    case "platform_fee":
    case "withdrawal":
    case "purchase":
      return "-";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransactionTableProps {
  transactions: Transaction[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionTable({ transactions }: TransactionTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));
  const paginatedTx = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-neon" />
            Recent Transactions
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 && "s"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No transactions yet. Earnings from sales will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="pb-3 pr-4 text-left font-medium">Date</th>
                    <th className="pb-3 pr-4 text-left font-medium">Type</th>
                    <th className="pb-3 pr-4 text-right font-medium">Amount</th>
                    <th className="pb-3 pr-4 text-left font-medium">Status</th>
                    <th className="pb-3 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTx.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <span className="block text-[10px] text-muted-foreground/60">
                          {new Date(tx.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3 pr-4">
                        <span className={`font-medium ${txTypeColor(tx.type)}`}>
                          {txTypeLabel(tx.type)}
                        </span>
                        {tx.chain && (
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {tx.chain}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <span className={`font-mono font-medium ${txTypeColor(tx.type)}`}>
                          {txAmountPrefix(tx.type)}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 pr-4">{txStatusBadge(tx.status)}</td>

                      {/* Description */}
                      <td className="py-3 max-w-[200px] truncate text-muted-foreground text-xs">
                        {tx.description || "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      return (
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1
                      );
                    })
                    .map((page, idx, arr) => {
                      const showEllipsisBefore =
                        idx > 0 && page - arr[idx - 1] > 1;
                      return (
                        <span key={page} className="flex items-center">
                          {showEllipsisBefore && (
                            <span className="px-1 text-xs text-muted-foreground">
                              ...
                            </span>
                          )}
                          <Button
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`h-8 w-8 p-0 ${
                              page === currentPage
                                ? "bg-neon text-background hover:bg-neon/90"
                                : ""
                            }`}
                          >
                            {page}
                          </Button>
                        </span>
                      );
                    })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
