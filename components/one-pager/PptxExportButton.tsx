import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PptxExportButtonProps {
  href: string
}

export function PptxExportButton({ href }: PptxExportButtonProps) {
  return (
    <a
      href={href}
      download
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'gap-1.5 no-print'
      )}
    >
      <Download className="h-4 w-4" />
      PPTX出力
    </a>
  )
}
