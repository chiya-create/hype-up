interface OnePagerListProps {
  items: string[]
  maxItems?: number
  truncateAt?: number
  numbered?: boolean
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

export function OnePagerList({
  items,
  maxItems = 5,
  truncateAt = 65,
  numbered = false,
}: OnePagerListProps) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">該当データはありません</p>
  }

  const visible = items.slice(0, maxItems)

  return (
    <ul className="space-y-1">
      {visible.map((item, i) => (
        <li key={i} className="text-xs leading-relaxed flex gap-1.5">
          {numbered ? (
            <span className="shrink-0 font-semibold text-muted-foreground w-3.5">{i + 1}.</span>
          ) : (
            <span className="shrink-0 text-muted-foreground mt-px">•</span>
          )}
          <span>{truncate(item, truncateAt)}</span>
        </li>
      ))}
    </ul>
  )
}
