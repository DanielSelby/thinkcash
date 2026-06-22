'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Target, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { APP_CONFIG, THEMES } from '@/lib/config'

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(v => v, 'You must accept the terms'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

interface Props { loginLogo: string | null }

export function RegisterForm({ loginLogo }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const password = watch('password', '')
  const strengthChecks = [
    { label: '8+ characters',    met: password.length >= 8    },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password)  },
    { label: 'Number',           met: /[0-9]/.test(password)  },
  ]

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast({ title: 'Registration failed', description: error.message, variant: 'destructive' })
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-mesh flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Check your email</h2>
          <p className="text-muted-foreground text-sm">
            We have sent a verification link to your email. Click it to activate your account.
          </p>
          <Button className="mt-6" onClick={() => router.push('/auth/login')}>Back to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {loginLogo ? (
            <img
              src={loginLogo}
              alt={APP_CONFIG.name}
              className="h-24 w-auto object-contain mx-auto mb-4"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl shadow-lg mb-4"
              style={{ background: THEMES[APP_CONFIG.defaultTheme].colors.primary }}>
              <Target className="w-6 h-6 text-white" />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Start your financial journey with {APP_CONFIG.name}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Mensah"
                {...register('fullName')}
                className={errors.fullName ? 'border-destructive' : ''}
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  {...register('password')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="flex gap-3 mt-1 flex-wrap">
                  {strengthChecks.map(c => (
                    <span
                      key={c.label}
                      className={`text-xs flex items-center gap-1 ${c.met ? 'text-success' : 'text-muted-foreground'}`}
                    >
                      <Check className={`w-3 h-3 ${c.met ? 'text-success' : 'text-muted-foreground/40'}`} />
                      {c.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                {...register('confirmPassword')}
                className={errors.confirmPassword ? 'border-destructive' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="terms"
                {...register('terms')}
                className="w-4 h-4 rounded border-border mt-0.5"
              />
              <Label htmlFor="terms" className="font-normal text-muted-foreground text-sm cursor-pointer leading-snug">
                I agree to the{' '}
                <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </Label>
            </div>
            {errors.terms && <p className="text-xs text-destructive">{errors.terms.message}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {APP_CONFIG.tagline}
        </p>
      </div>
    </div>
  )
}