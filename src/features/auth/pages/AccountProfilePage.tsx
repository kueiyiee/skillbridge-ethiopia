import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Edit3, Check, ChevronDown, UserCheck, Plus, RefreshCw, Shield, MapPin, ShieldCheck, Trash2, RotateCcw, LogOut, User, Briefcase, Lock } from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { api, type AccountProfile, type AccountProfileUpdate } from '@/src/services/api-client';
import { BackButton } from '@/src/components/navigation/BackButton';
import { PasswordChangeForm } from '@/src/features/auth/components/PasswordChangeForm';

const imageMaxBytes = 2 * 1024 * 1024;
const phonePrefixes = ['+251', '+1', '+44', '+91', '+254', '+971'];

type ImageKind = 'avatar' | 'cover';
type Draft = AccountProfileUpdate;

const emptyDraft: Draft = {
  firstName: '', middleName: '', lastName: '', username: '', phone: '', dateOfBirth: '', gender: '', genderDescription: '',
  country: 'Ethiopia', region: '', city: '', headline: '', bio: '', preferredLanguage: 'en', portfolioUrl: '', linkedinUrl: '', website: '',
  companyName: '', industry: '', employeeRange: '',
  profileVisibility: 'PRIVATE', showPhone: false, showEmail: false, showLocation: false, showGender: false,
  candidateSearchable: false, employerDiscoverable: false,
};

function fieldClass() {
  return 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-4 focus:ring-sky-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400';
}

function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor: string; hint?: string }) {
  return <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{children}{hint && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{hint}</span>}</label>;
}

function Section({ id, eyebrow, title, description, children }: { id?: string; eyebrow?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">{eyebrow}</p>}
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function Toggle({ id, title, description, checked, onChange }: { id: string; title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-[68px] cursor-pointer items-center justify-between gap-4 border-b border-slate-100 py-3.5 last:border-0 dark:border-slate-800">
      <span className="min-w-0"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span></span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-sky-700 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-600 dark:bg-slate-700 dark:peer-checked:bg-sky-500" />
    </label>
  );
}

export const AccountProfilePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, candidateProfile, updateUser, logout, refreshCandidate, refreshEmployer } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [savedDraft, setSavedDraft] = useState<Draft>(emptyDraft);
  const [phonePrefix, setPhonePrefix] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [selectedImages, setSelectedImages] = useState<Partial<Record<ImageKind, string>>>({});
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [brokenImage, setBrokenImage] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(() => location.hash.slice(1) || (location.pathname === '/account/settings' ? 'privacy' : 'personal-information'));

  const applyProfile = (result: AccountProfile) => {
    setProfile(result);
    const account = result.user;
    const roleProfile = result.roleProfile || {};
    const phone = account.phone || '';
    const prefix = phonePrefixes.find((item) => phone.startsWith(item)) || (phone ? '' : '+251');
    setPhonePrefix(prefix);
    setPhoneNumber(prefix ? phone.slice(prefix.length).trim() : phone);
    const profileDraft: Draft = {
      ...emptyDraft,
      firstName: account.firstName || '', middleName: account.middleName || '', lastName: account.lastName || '',
      username: account.username || '', phone: account.phone || '', dateOfBirth: account.dateOfBirth || '',
      gender: account.gender || '', genderDescription: account.genderDescription || '', country: account.country || 'Ethiopia',
      region: account.region || '', city: String(roleProfile.city || ''), headline: String(roleProfile.headline || ''),
      bio: String(roleProfile.bio || roleProfile.companyOverview || ''), preferredLanguage: account.preferredLanguage || 'en',
      portfolioUrl: String(roleProfile.portfolioUrl || ''), linkedinUrl: String(roleProfile.linkedinUrl || ''), website: String(roleProfile.website || ''),
      companyName: String(roleProfile.companyName || ''), industry: String(roleProfile.industry || ''), employeeRange: String(roleProfile.employeeRange || ''),
      profileVisibility: account.profileVisibility || 'PRIVATE', showPhone: Boolean(account.showPhone), showEmail: Boolean(account.showEmail),
      showLocation: Boolean(account.showLocation), showGender: Boolean(account.showGender), candidateSearchable: Boolean(account.candidateSearchable),
      employerDiscoverable: Boolean(account.employerDiscoverable),
    };
    setDraft(profileDraft);
    setSavedDraft(profileDraft);
  };

  const loadProfile = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      applyProfile(await api.getAccountProfile());
    } catch (error: unknown) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Profile could not be loaded.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.getAccountProfile().then((result) => {
      if (!active) return;
      applyProfile(result);
    }).catch((error: unknown) => {
      if (active) setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Profile could not be loaded.' });
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const roleProfile = profile?.roleProfile || {};
  const role = profile?.role || user?.role || 'JOB_SEEKER';
  const displayName = profile?.user.fullName || user?.fullName || 'Your profile';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U';
  const locationText = [draft.city || roleProfile.city, draft.region, draft.country].filter(Boolean).join(', ');
  const currentPhone = phoneNumber.trim() ? (phonePrefix ? `${phonePrefix} ${phoneNumber.trim()}` : phoneNumber.trim()) : '';
  const hasUnsavedChanges = JSON.stringify({ ...draft, phone: currentPhone }) !== JSON.stringify(savedDraft);
  const profileSections = [
    { id: 'personal-information', label: 'Personal Information', icon: User },
    role === 'EMPLOYER'
      ? { id: 'organization-information', label: 'Organization Profile', icon: Briefcase }
      : role === 'JOB_SEEKER'
        ? { id: 'career-information', label: 'Career Profile', icon: Briefcase }
        : { id: 'admin-information', label: 'Administrative Profile', icon: Briefcase },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'account-actions', label: 'Account Actions', icon: LogOut },
  ];
  const activeSectionDefinition = profileSections.find((section) => section.id === activeSection) || profileSections[0];

  useEffect(() => {
    const section = location.hash.slice(1);
    if (location.pathname === '/account/settings' && !section) {
      setActiveSection('privacy');
    } else if (new URLSearchParams(location.search).get('edit') === 'true') {
      setActiveSection('personal-information');
    } else if (section && profileSections.some((item) => item.id === section)) {
      setActiveSection(section);
    } else if (section) {
      setActiveSection('personal-information');
    }
  }, [location.hash, location.pathname, location.search, role]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      const payload = { ...draft, phone: currentPhone };
      const result = await api.updateAccountProfile(payload);
      setProfile(result);
      setDraft((current) => ({ ...current, phone: payload.phone }));
      setSavedDraft({ ...draft, phone: payload.phone });
      updateUser({ fullName: result.user.fullName, avatarUrl: result.user.avatarUrl });
      setMessage({ kind: 'success', text: 'Your profile changes are saved.' });
      try {
        if (role === 'JOB_SEEKER') await refreshCandidate();
        if (role === 'EMPLOYER') await refreshEmployer();
      } catch (refreshError) {
        setMessage({
          kind: 'error',
          text: `Your profile was saved, but dashboard data could not be refreshed: ${refreshError instanceof Error ? refreshError.message : 'Please reload the page.'}`,
        });
      }
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Profile could not be saved. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectImage = (kind: ImageKind, file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ kind: 'error', text: 'Choose a JPG, PNG, or WebP image.' });
      return;
    }
    if (file.size > imageMaxBytes) {
      setMessage({ kind: 'error', text: 'Choose an image no larger than 2 MB.' });
      return;
    }
    setMessage(null);
    const previousPreview = selectedImages[kind];
    if (previousPreview) URL.revokeObjectURL(previousPreview);
    setSelectedImages((current) => ({ ...current, [kind]: URL.createObjectURL(file) }));
  };

  const cancelImage = (kind: ImageKind) => {
    const preview = selectedImages[kind];
    if (preview) URL.revokeObjectURL(preview);
    setSelectedImages((current) => ({ ...current, [kind]: undefined }));
  };

  const uploadImage = async (kind: ImageKind) => {
    const preview = selectedImages[kind];
    if (!preview) return;
    const file = document.querySelector<HTMLInputElement>(`#${kind}-upload`)?.files?.[0];
    if (!file) return;
    setUploading(kind);
    setUploadProgress(0);
    setMessage(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image.'));
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const result = await api.uploadProfileImage(kind, base64, setUploadProgress);
      setProfile((current) => current ? { ...current, user: { ...current.user, [kind === 'avatar' ? 'avatarUrl' : 'coverUrl']: result.url } } : current);
      if (kind === 'avatar') updateUser({ avatarUrl: result.url });
      cancelImage(kind);
      setBrokenImage(false);
      setMessage({ kind: 'success', text: `${kind === 'avatar' ? 'Profile photo' : 'Cover image'} updated.` });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Image upload failed. Please try again.' });
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (kind: ImageKind) => {
    setMessage(null);
    try {
      await api.removeProfileImage(kind);
      setProfile((current) => current ? { ...current, user: { ...current.user, [kind === 'avatar' ? 'avatarUrl' : 'coverUrl']: null } } : current);
      if (kind === 'avatar') updateUser({ avatarUrl: null });
      setBrokenImage(false);
      setMessage({ kind: 'success', text: `${kind === 'avatar' ? 'Profile photo' : 'Cover image'} removed.` });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Image could not be removed.' });
    }
  };

  const discardChanges = () => {
    const phone = savedDraft.phone || '';
    const prefix = phonePrefixes.find((item) => phone.startsWith(item)) || (phone ? '' : '+251');
    setDraft(savedDraft);
    setPhonePrefix(prefix);
    setPhoneNumber(phone.startsWith(prefix) ? phone.slice(prefix.length).trim() : phone);
    setMessage(null);
  };

  const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'EMPLOYER' ? 'Employer' : 'Job seeker';
  const emailVerified = user?.emailVerified === true;
  const employerVerificationApproved = roleProfile.isApproved === true;
  const organizationName = role === 'EMPLOYER' ? String(roleProfile.companyName || draft.companyName || '') : '';
  const profileCompletion = role === 'JOB_SEEKER'
    ? Math.round([
      Boolean(draft.headline.trim()),
      Boolean(draft.bio.trim()),
      Boolean(candidateProfile?.desiredRole?.trim()),
      Boolean(candidateProfile?.educationLevel?.trim() || candidateProfile?.institutionName?.trim()),
      Boolean(candidateProfile?.skills?.length),
      Boolean(draft.city.trim()),
    ].filter(Boolean).length / 6 * 100)
    : role === 'EMPLOYER'
      ? Math.round([
        Boolean(draft.companyName.trim()),
        Boolean(draft.industry.trim()),
        Boolean(draft.bio.trim()),
        Boolean(draft.website.trim()),
        Boolean(draft.city.trim()),
      ].filter(Boolean).length / 5 * 100)
      : null;

  const handleSignOut = async () => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved profile changes. Sign out without saving?')) return;
    if (!window.confirm('Are you sure you want to sign out?')) return;
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Sign out failed. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) return <main className="mx-auto flex min-h-[55vh] max-w-5xl items-center justify-center px-4 text-sm text-slate-600 dark:text-slate-300" role="status"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading your profile…</main>;
  if (!profile) return (
    <main className="sb-page mx-auto flex min-h-[55vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-900 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-slate-950 dark:text-white">Profile unavailable</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message?.text || 'Your profile could not be loaded.'}</p>
        <button type="button" onClick={() => void loadProfile()} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Retry
        </button>
      </div>
    </main>
  );

  return (
    <main className="sb-page mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton
            fallbackTo={role === 'EMPLOYER' ? '/dashboard/employer' : role === 'ADMIN' ? '/admin' : '/dashboard/seeker'}
            fallbackLabel="Back to Dashboard"
            onBeforeNavigate={() => !hasUnsavedChanges || window.confirm('You have unsaved profile changes. Leave without saving?')}
          />
          <div className="min-w-0 border-l border-slate-200 pl-3 dark:border-slate-700">
            <h1 className="truncate text-lg font-bold text-slate-950 dark:text-white sm:text-xl">Settings</h1>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Profile, privacy, and account security in one place.</p>
          </div>
        </div>
      </div>

      {message && <div className={`mb-4 flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'}`} role={message.kind === 'error' ? 'alert' : 'status'} aria-live={message.kind === 'error' ? 'assertive' : 'polite'}>{message.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}{message.text}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Profile overview">
        <div className="relative h-14 overflow-hidden bg-slate-800 sm:h-16">
          {(selectedImages.cover || profile?.user.coverUrl) && <img src={selectedImages.cover || profile?.user.coverUrl || ''} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2 sm:right-5 sm:top-5">
            <label htmlFor="cover-upload" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/35 bg-slate-950/45 px-3 text-xs font-semibold text-white backdrop-blur transition hover:bg-slate-950/70"><Plus className="h-4 w-4" />{selectedImages.cover ? 'Replace cover' : 'Change cover'}</label>
            <input id="cover-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectImage('cover', event.target.files?.[0])} />
            {profile?.user.coverUrl && !selectedImages.cover && <button type="button" onClick={() => void removeImage('cover')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/35 bg-slate-950/45 px-3 text-xs font-semibold text-white backdrop-blur transition hover:bg-rose-800/80"><Trash2 className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Remove cover</span></button>}
          </div>
        </div>

        <div className="relative px-4 pb-4 sm:px-6">
          <div className="-mt-7 flex flex-wrap items-end justify-between gap-4 sm:-mt-8">
            <div className="flex min-w-0 items-end gap-3 sm:gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-slate-900 text-white shadow-md dark:border-slate-900 sm:h-20 sm:w-20">
                {profile?.user.avatarUrl && !brokenImage ? <img src={profile.user.avatarUrl} alt={`${displayName} profile`} onError={() => setBrokenImage(true)} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-2xl font-bold">{initials}</span>}
                <label htmlFor="avatar-upload" className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-slate-950 text-white transition hover:bg-sky-700" aria-label="Change profile photo"><Edit3 className="h-4 w-4" /></label>
                <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectImage('avatar', event.target.files?.[0])} />
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{roleLabel}</p>
                <h2 className="mt-0.5 truncate text-lg font-bold tracking-tight text-slate-950 dark:text-white">{displayName}</h2>
                <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">{organizationName || draft.headline || (role === 'ADMIN' ? 'Platform administration' : 'Add a professional headline')}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${emailVerified ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                    {emailVerified ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {emailVerified ? 'Email verified' : 'Email verification needed'}
                  </span>
                  {role === 'EMPLOYER' && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${employerVerificationApproved ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                      {employerVerificationApproved ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      {employerVerificationApproved ? 'Business verified' : 'Business verification pending'}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{locationText || 'Add your location'}</span>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:pb-1">
              {selectedImages.avatar && <><button type="button" onClick={() => void uploadImage('avatar')} disabled={uploading !== null} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500 sm:flex-none"><Plus className="h-4 w-4" />{uploading === 'avatar' ? `Uploading ${uploadProgress}%` : 'Save photo'}</button><button type="button" onClick={() => cancelImage('avatar')} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button></>}
              {profile?.user.avatarUrl && !selectedImages.avatar && <button type="button" onClick={() => void removeImage('avatar')} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-rose-400 hover:text-rose-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-rose-300">Remove photo</button>}
              {selectedImages.cover && <><button type="button" onClick={() => void uploadImage('cover')} disabled={uploading !== null} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500 sm:flex-none"><Plus className="h-4 w-4" />{uploading === 'cover' ? `Uploading ${uploadProgress}%` : 'Save cover'}</button><button type="button" onClick={() => cancelImage('cover')} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button></>}
            </div>
          </div>
          {uploading && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-sky-600 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {profile?.user.username && <span>@{profile.user.username}</span>}
            {profile?.user.createdAt && <span>Joined {new Date(profile.user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>}
            <span className="inline-flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" />{profile?.user.profileVisibility || 'PRIVATE'} profile</span>
          </div>
          {profileCompletion !== null && <div className="mt-4 max-w-md border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-700 dark:text-slate-200">Profile completion</span><span className="font-bold tabular-nums text-slate-900 dark:text-white">{profileCompletion}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileCompletion}>
              <div className="h-full rounded-full bg-sky-700 transition-[width] dark:bg-sky-400" style={{ width: `${profileCompletion}%` }} />
            </div>
          </div>}
        </div>
      </section>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Settings sections" className="flex min-w-0 gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24 lg:block lg:space-y-1 lg:overflow-visible lg:rounded-2xl lg:border-0 lg:bg-transparent lg:p-0 dark:lg:bg-transparent">
          {profileSections.map((section) => (
            <button key={section.id} type="button" aria-controls="settings-section-panel" onClick={() => {
              setActiveSection(section.id);
              window.history.replaceState(null, '', `${location.pathname}${location.search}#${section.id}`);
            }} aria-current={activeSection === section.id ? 'page' : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 lg:flex lg:w-full ${activeSection === section.id ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
              <section.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {section.label}
            </button>
          ))}
        </nav>
        <div id="settings-section-panel" className="min-w-0 space-y-4" aria-live="polite">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Settings</p>
              <h2 className="mt-1 truncate text-lg font-bold text-slate-950 dark:text-white">{activeSectionDefinition.label}</h2>
            </div>
            {hasUnsavedChanges && <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Unsaved changes</span>}
          </div>

          {['personal-information', 'career-information', 'organization-information', 'admin-information', 'privacy'].includes(activeSection) && (
          <form onSubmit={saveProfile} className="min-w-0 space-y-4" aria-busy={isSaving}>
        {activeSection === 'personal-information' && <Section id="personal-information" title="Personal Information" description="Update the identity and contact details associated with your account.">
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label htmlFor="first-name">First name</Label><input id="first-name" required maxLength={80} className={fieldClass()} value={draft.firstName} onChange={(event) => update('firstName', event.target.value)} /></div>
            <div><Label htmlFor="middle-name" hint="Optional">Middle name</Label><input id="middle-name" maxLength={80} className={fieldClass()} value={draft.middleName} onChange={(event) => update('middleName', event.target.value)} /></div>
            <div><Label htmlFor="last-name">Last name</Label><input id="last-name" maxLength={80} className={fieldClass()} value={draft.lastName} onChange={(event) => update('lastName', event.target.value)} /></div>
            <div><Label htmlFor="username" hint="Optional">Username</Label><input id="username" maxLength={64} pattern="(?:[A-Za-z0-9_]{3,32}|[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)" className={fieldClass()} value={draft.username} onChange={(event) => update('username', event.target.value)} placeholder="Username or admin email" /></div>
            <div><Label htmlFor="email">Email address</Label><input id="email" type="email" className={`${fieldClass()} bg-slate-50 dark:bg-slate-900`} value={profile?.user.email || user?.email || ''} readOnly aria-describedby="email-note" /><p id="email-note" className="mt-1 text-xs text-slate-500 dark:text-slate-400">Email changes require verification.</p></div>
            <div><Label htmlFor="phone-number" hint="Optional">Phone number</Label><div className="mt-1.5 flex gap-2"><select aria-label="Country calling code" className="min-h-11 w-[6.5rem] shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={phonePrefix} onChange={(event) => setPhonePrefix(event.target.value)}><option value="">Other</option>{phonePrefixes.map((prefix) => <option key={prefix} value={prefix}>{prefix}</option>)}</select><input id="phone-number" type="tel" autoComplete="tel-national" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone number" /></div></div>
            <div><Label htmlFor="date-of-birth" hint="Optional">Date of birth</Label><input id="date-of-birth" type="date" className={fieldClass()} value={draft.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></div>
            <div><Label htmlFor="gender" hint="Optional · private by default">Gender</Label><select id="gender" className={fieldClass()} value={draft.gender} onChange={(event) => update('gender', event.target.value)}><option value="">Choose not to share</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option><option value="SELF_DESCRIBED">Self-described</option></select></div>
            {draft.gender === 'SELF_DESCRIBED' && <div><Label htmlFor="gender-description">Self-described gender</Label><input id="gender-description" maxLength={80} className={fieldClass()} value={draft.genderDescription} onChange={(event) => update('genderDescription', event.target.value)} /></div>}
            <div><Label htmlFor="country">Country</Label><input id="country" maxLength={100} className={fieldClass()} value={draft.country} onChange={(event) => update('country', event.target.value)} /></div>
            <div><Label htmlFor="region">Region / state</Label><input id="region" maxLength={100} className={fieldClass()} value={draft.region} onChange={(event) => update('region', event.target.value)} placeholder="e.g. Addis Ababa" /></div>
            <div><Label htmlFor="city">City</Label><input id="city" maxLength={100} className={fieldClass()} value={draft.city} onChange={(event) => update('city', event.target.value)} placeholder="City or town" /></div>
            <div><Label htmlFor="preferred-language">Preferred language</Label><select id="preferred-language" className={fieldClass()} value={draft.preferredLanguage} onChange={(event) => update('preferredLanguage', event.target.value)}><option value="en">English</option><option value="am">Amharic</option><option value="om">Oromoo</option><option value="ti">Tigrinya</option></select></div>
          </div>
        </Section>}

        {activeSection === 'career-information' && role === 'JOB_SEEKER' && <Section id="career-information" title="Career Profile" description="Present your professional focus and links using your saved candidate profile.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="headline">Professional headline</Label><input id="headline" maxLength={160} className={fieldClass()} value={draft.headline} onChange={(event) => update('headline', event.target.value)} placeholder="e.g. Frontend developer focused on accessible products" /></div>
            <div className="sm:col-span-2"><Label htmlFor="bio">About me</Label><textarea id="bio" rows={4} maxLength={2000} className={`${fieldClass()} py-3`} value={draft.bio} onChange={(event) => update('bio', event.target.value)} placeholder="Share a short professional introduction" /><p className="mt-1 text-right text-xs text-slate-500">{draft.bio.length}/2000</p></div>
            <div><Label htmlFor="portfolio">Portfolio / personal website</Label><input id="portfolio" type="url" maxLength={500} className={fieldClass()} value={draft.portfolioUrl} onChange={(event) => update('portfolioUrl', event.target.value)} placeholder="https://" /></div>
            <div><Label htmlFor="linkedin">LinkedIn profile</Label><input id="linkedin" type="url" maxLength={500} className={fieldClass()} value={draft.linkedinUrl} onChange={(event) => update('linkedinUrl', event.target.value)} placeholder="https://linkedin.com/in/" /></div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">Skills are managed in your candidate workspace.</p>
            <button type="button" onClick={() => {
              if (hasUnsavedChanges && !window.confirm('You have unsaved profile changes. Leave without saving?')) return;
              navigate('/dashboard/seeker?tab=skills');
            }} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Manage skills</button>
          </div>
        </Section>}

        {activeSection === 'organization-information' && role === 'EMPLOYER' && <Section id="organization-information" title="Organization Profile" description="Manage your organization's profile details.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="company-name">Organization</Label><input id="company-name" required minLength={2} maxLength={160} className={fieldClass()} value={draft.companyName} onChange={(event) => update('companyName', event.target.value)} /></div>
            <div><Label htmlFor="industry">Industry</Label><input id="industry" required minLength={2} maxLength={120} className={fieldClass()} value={draft.industry} onChange={(event) => update('industry', event.target.value)} /></div>
            <div><Label htmlFor="employee-range">Organization size</Label><input id="employee-range" maxLength={80} className={fieldClass()} value={draft.employeeRange} onChange={(event) => update('employeeRange', event.target.value)} placeholder="e.g. 11–50 employees" /></div>
            <div><Label htmlFor="website">Website</Label><input id="website" type="url" maxLength={500} className={fieldClass()} value={draft.website} onChange={(event) => update('website', event.target.value)} placeholder="https://" /></div>
            <div className="sm:col-span-2"><Label htmlFor="bio">Organization overview</Label><textarea id="bio" rows={4} maxLength={2000} className={`${fieldClass()} py-3`} value={draft.bio} onChange={(event) => update('bio', event.target.value)} /></div>
          </div>
        </Section>}

        {activeSection === 'admin-information' && role === 'ADMIN' && <Section id="admin-information" title="Administrative Profile"><p className="text-sm text-slate-600 dark:text-slate-400">No public role-specific profile is associated with this administrator account.</p></Section>}

        {activeSection === 'privacy' && <Section id="privacy" title="Privacy" description="Choose whether verified employers can find your profile and which personal details they may see.">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div><Label htmlFor="profile-visibility">Employer profile visibility</Label><div className="relative"><select id="profile-visibility" className={`${fieldClass()} appearance-none pr-10`} value={draft.profileVisibility} onChange={(event) => update('profileVisibility', event.target.value as Draft['profileVisibility'])}><option value="PRIVATE">Private — hide from candidate search</option><option value="REGISTERED">Registered — allow verified employers</option><option value="PUBLIC">Public — allow verified employers</option></select><ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-slate-500" /></div><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Candidate search is only available to approved employers. PRIVATE hides you from search; REGISTERED and PUBLIC currently have the same effect in this directory. Your name and application remain visible to the employer receiving an application even when your profile is private.</p>
              {role === 'JOB_SEEKER' && <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-900 dark:bg-cyan-950/30">
                <p className="text-xs font-bold uppercase tracking-wide text-cyan-950 dark:text-cyan-100">Candidate discovery consent</p>
                <p className="mt-1 text-xs leading-5 text-cyan-950/80 dark:text-cyan-100/80">Both preferences below must be enabled, and visibility must be REGISTERED or PUBLIC, before verified employers can find your profile. Changes apply to the next search request.</p>
                <Toggle id="candidate-searchable" title="Appear in candidate search" description="Include your opted-in profile in employer search results." checked={draft.candidateSearchable} onChange={(value) => update('candidateSearchable', value)} />
                <Toggle id="employer-discoverable" title="Discoverable by employers" description="Allow approved employers to open your profile in the candidate directory." checked={draft.employerDiscoverable} onChange={(value) => update('employerDiscoverable', value)} />
              </div>}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <Toggle id="privacy-phone" title="Show my phone number" description="Share with employers in application reviews and, if discoverable, your candidate profile." checked={draft.showPhone} onChange={(value) => update('showPhone', value)} />
              <Toggle id="privacy-email" title="Show my email address" description="Share with employers in application reviews and, if discoverable, your candidate profile." checked={draft.showEmail} onChange={(value) => update('showEmail', value)} />
              <Toggle id="privacy-location" title="Show my location" description="Share your city in application reviews and candidate search; hidden locations are excluded from location filtering." checked={draft.showLocation} onChange={(value) => update('showLocation', value)} />
              {role === 'JOB_SEEKER' && <Toggle id="privacy-gender" title="Share gender in candidate search" description="Optional. Gender is never used as a search filter and is hidden unless you enable this." checked={draft.showGender} onChange={(value) => update('showGender', value)} />}
            </div>
          </div>
        </Section>}

        <div className="sticky bottom-3 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4 dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex flex-col gap-2 sm:flex-row">
            {hasUnsavedChanges && <button type="button" onClick={discardChanges} disabled={isSaving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><RotateCcw className="h-4 w-4" />Discard changes</button>}
          </div>
          <button type="submit" disabled={isSaving || !hasUnsavedChanges} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">{isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isSaving ? 'Saving…' : 'Save Changes'}</button>
        </div>
          </form>
          )}

          {activeSection === 'security' && <Section id="security" title="Security" description="Change your password and review security guidance for your account.">
            <PasswordChangeForm />
          </Section>}

          {activeSection === 'account-actions' && <section className="rounded-2xl border border-rose-200 bg-white p-4 dark:border-rose-900/70 dark:bg-slate-900 sm:p-5" aria-labelledby="settings-sign-out-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="settings-sign-out-title" className="text-base font-bold text-slate-950 dark:text-white">Sign out</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">End your current session on this device.</p>
          </div>
          <button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">
            <LogOut className="h-4 w-4" aria-hidden="true" />{isSigningOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
        {signOutError && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{signOutError}</p>}
          </section>}

        </div>
      </div>
    </main>
  );
};