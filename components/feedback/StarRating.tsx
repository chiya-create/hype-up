'use client'

import { Star } from 'lucide-react'

interface StarRatingProps {
  value: number | null
  onChange: (value: number) => void
  label: string
}

export function StarRating({ value, onChange, label }: StarRatingProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-0.5 hover:scale-110 transition-transform focus:outline-none"
            aria-label={`${star}点`}
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                value !== null && star <= value
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
      {value !== null && (
        <span className="text-xs text-muted-foreground tabular-nums">{value}/5</span>
      )}
    </div>
  )
}
