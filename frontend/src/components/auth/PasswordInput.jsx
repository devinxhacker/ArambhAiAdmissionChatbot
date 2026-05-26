import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─── Strength calculator ──────────────────────────────────────────────────────

const getStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const levels = [
    { label: '', color: '' },
    { label: 'Very weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Fair', color: 'bg-yellow-500' },
    { label: 'Strong', color: 'bg-blue-500' },
    { label: 'Very strong', color: 'bg-green-500' },
  ]
  return { score, ...levels[score] }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PasswordInput — Input with show/hide toggle and optional strength meter.
 *
 * @param {boolean} showStrength - Show the strength bar below the input.
 * @param {string}  value        - Controlled value.
 * All other props are forwarded to the underlying <Input />.
 */
export default function PasswordInput({ showStrength = false, value = '', className, ...props }) {
  const [visible, setVisible] = useState(false)
  const strength = showStrength ? getStrength(value) : null

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="space-y-1">
          {/* Segmented bar */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((seg) => (
              <div
                key={seg}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  strength.score >= seg ? strength.color : 'bg-muted'
                )}
              />
            ))}
          </div>
          {strength.label && (
            <p className="text-xs text-muted-foreground">{strength.label}</p>
          )}
        </div>
      )}
    </div>
  )
}
