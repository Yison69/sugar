import { cn } from '@/lib/utils'
import type { TextareaHTMLAttributes } from 'react'

export default function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm outline-none transition focus:border-zinc-900',
        className,
      )}
      {...props}
    />
  )
}

