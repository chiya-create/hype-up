'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PurchaseReason } from '@/types/analysis'

interface PurchaseReasonsChartProps {
  data: PurchaseReason[]
}

export function PurchaseReasonsChart({ data }: PurchaseReasonsChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          購買理由のデータがありません
        </CardContent>
      </Card>
    )
  }

  const chartData = data.slice(0, 8).map((d) => ({
    label: d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label,
    fullLabel: d.label,
    count: d.count,
  }))

  return (
    <div className="space-y-6">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [value, '件数']}
              labelFormatter={(label) => {
                const l = String(label)
                const item = chartData.find((d) => d.label === l)
                return item?.fullLabel ?? l
              }}
            />
            <Legend />
            <Bar dataKey="count" name="件数" fill="hsl(var(--primary))" opacity={0.85} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        {data.slice(0, 5).map((reason, i) => (
          <Card key={i}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                {reason.label}
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {reason.count} 件
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reason.surface_reason && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      表面的な理由
                    </p>
                    <p className="text-xs leading-relaxed">{reason.surface_reason}</p>
                  </div>
                )}
                {reason.deep_psychology && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-0.5">
                      深層心理
                    </p>
                    <p className="text-xs leading-relaxed">{reason.deep_psychology}</p>
                  </div>
                )}
              </div>
              {reason.examples.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">レビュー例</p>
                  <ul className="space-y-1">
                    {reason.examples.slice(0, 2).map((ex, j) => (
                      <li key={j} className="text-xs text-muted-foreground leading-relaxed">
                        「{ex}」
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
