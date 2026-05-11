'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RatingPoint } from '@/types/analysis'

interface RatingPointsChartProps {
  data: RatingPoint[]
}

export function RatingPointsChart({ data }: RatingPointsChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          評価ポイントのデータがありません
        </CardContent>
      </Card>
    )
  }

  const chartData = data.slice(0, 10).map((d) => ({
    label: d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label,
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
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-4">
        {data.slice(0, 5).map((point, i) => (
          <Card key={i}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                {point.label}
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {point.count} 件
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {point.copyworthy_phrases.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">コピー候補フレーズ</p>
                  <div className="flex flex-wrap gap-1.5">
                    {point.copyworthy_phrases.map((phrase, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {point.examples.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">レビュー例</p>
                  <ul className="space-y-1">
                    {point.examples.slice(0, 2).map((ex, j) => (
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
