'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Camera, Key, Trash2, Loader2, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc'
import { Separator } from '@/components/ui/misc'
import { toast } from '@/components/ui/toaster'
import { useAppStore } from '@/store'
import type { Profile } from '@/types'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
})

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

interface Props { profile: Profile | null; userId: string }

export function ProfileContent({ profile, userId }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [loadingAvatar, setLoadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { setProfile } = useAppStore()

  const { register: regProfile, handleSubmit: handleProfile, formState: { errors: profileErrors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name || '', email: profile?.email || '' },
  })

  const { register: regPassword, handleSubmit: handlePassword, reset: resetPassword, formState: { errors: passwordErrors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'TS'

  const onProfileSubmit = async (data: ProfileForm) => {
    setLoadingProfile(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ full_name: data.full_name, updated_at: new Date().toISOString() }).eq('id', userId)
    if (error) toast({ title: 'Save error', description: error.message, variant: 'destructive' })
    else {
      if (profile) setProfile({ ...profile, full_name: data.full_name })
      toast({ title: 'Profile updated', variant: 'success' })
      setTimeout(() => window.location.reload(), 1000)
    }
    setLoadingProfile(false)
  }

  const onPasswordSubmit = async (data: PasswordForm) => {
    setLoadingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) toast({ title: 'Password update failed', description: error.message, variant: 'destructive' })
    else { toast({ title: 'Password updated', variant: 'success' }); resetPassword() }
    setLoadingPassword(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingAvatar(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `avatars/${userId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' }); setLoadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(publicUrl)
    if (profile) setProfile({ ...profile, avatar_url: publicUrl })
    toast({ title: 'Avatar updated', variant: 'success' })
    setLoadingAvatar(false)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you absolutely sure? This will permanently delete your account and all data.')) return
    if (!confirm('This cannot be undone. Type OK to confirm.')) return
    toast({ title: 'Contact support to delete your account', variant: 'destructive' })
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your account settings</p>
      </div>

      {/* Avatar */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" />Profile Picture</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              {loadingAvatar && <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center"><Loader2 className="w-6 h-6 text-white animate-spin" /></div>}
            </div>
            <div>
              <p className="font-medium">{profile?.full_name}</p>
              <p className="text-sm text-muted-foreground mb-3">{profile?.email}</p>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Camera className="w-4 h-4" /> Change Photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleProfile(onProfileSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input {...regProfile('full_name')} />
              {profileErrors.full_name && <p className="text-xs text-destructive">{profileErrors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input {...regProfile('email')} disabled className="opacity-60 cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">Email cannot be changed from here</p>
            </div>
            <div className="space-y-1.5">
              <Label>Member Since</Label>
              <Input value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ''} disabled className="opacity-60 cursor-not-allowed" />
            </div>
            <Button type="submit" disabled={loadingProfile}>
              {loadingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4" />Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handlePassword(onPasswordSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" placeholder="Enter new password" {...regPassword('password')} />
              {passwordErrors.password && <p className="text-xs text-destructive">{passwordErrors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" placeholder="Repeat new password" {...regPassword('confirmPassword')} />
              {passwordErrors.confirmPassword && <p className="text-xs text-destructive">{passwordErrors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" variant="outline" disabled={loadingPassword}>
              {loadingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-base text-destructive flex items-center gap-2"><Shield className="w-4 h-4" />Danger Zone</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
          <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
            <Trash2 className="w-4 h-4" /> Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

