'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CustomerType } from '@/types/analysis'

const COLORS = [
  'hsl(var(--primary))',
  '#60a5fa',
  '#34d399',
  '#f59e0b',
  '#f87171',
  '#a78bfa',
  '#fb923c',
  '#38bdf8',
]

interface CustomerTypesChartProps {
  data: CustomerType[]
}

export function CustomerTypesChart({ data }: CustomerTypesChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          顧客タイプのデータがありません
        </CardContent>
      </Card>
    )
  }

  const chartData = data.slice(0, 8).map((d) => ({
    name: d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label,
    fullName: d.label,
    value: d.count,
  }))

  return (
    <div className="space-y-6">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={48}
              paddingAngle={2}
              label={({ name, percent }) =>
                `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const item = chartData.find((d) => d.name === name)
                return [value, item?.fullName ?? name]
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        {data.slice(0, 5).map((type, i) => (
          <Card key={i}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle
                className="text-sm font-semibold flex items-center gap-2"
              >
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                {type.label}
                <span className="text-xs text-muted-foreground font-normal">
                  {type.count} 件
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {type.description && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {type.description}
                </p>
              )}
              {type.ad_targeting_hint && (
                <div>
                  <p className="text-xs font-medium text-primary mb-0.5">
                    広告ターゲティングのヒント
                  </p>
                  <p className="text-xs leading-relaxed">{type.ad_targeting_hint}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
