'use client'

import { Printer } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'gap-1.5 no-print'
      )}
    >
      <Printer className="h-4 w-4" />
      PDF保存 / 印刷
    </button>
  )
}
