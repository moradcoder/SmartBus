// lib/auth-context.tsx - النسخة النهائية المستقرة
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase/client';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================
interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'driver' | 'admin' | 'super_admin';
  phone?: string;
  avatar_url?: string;
  driver_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  // ✅ متغيرات لمنع الحلقة اللانهائية
  const isFetchingRef = useRef(false);
  const isInitializedRef = useRef(false);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const authListenerRef = useRef<any>(null);

  // ============================================
  // دالة جلب أو إنشاء الملف الشخصي
  // ============================================
  const fetchOrCreateProfile = useCallback(async (
    userId: string,
    email: string,
    fullName?: string
  ): Promise<Profile | null> => {
    if (isFetchingRef.current) {
      console.log('⏳ Profile fetch already in progress, skipping...');
      return null;
    }

    try {
      isFetchingRef.current = true;
      console.log('🔍 Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching profile:', error);
        return null;
      }

      if (data) {
        console.log('✅ Profile found');
        return data;
      }

      console.log('🔄 Profile not found, creating...');
      
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: email,
          full_name: fullName || email?.split('@')[0] || 'مستخدم',
          role: 'customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating profile:', insertError);
        return null;
      }

      console.log('✅ Profile created');
      return newProfile;

    } catch (error) {
      console.error('❌ Error in fetchOrCreateProfile:', error);
      return null;
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // ============================================
  // دالة تحديث الملف الشخصي
  // ============================================
  const refreshProfile = useCallback(async () => {
    if (!user || isFetchingRef.current || !mountedRef.current) return;
    
    try {
      isFetchingRef.current = true;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Error refreshing profile:', error);
        return;
      }

      if (data && mountedRef.current) {
        setProfile(data);
        console.log('✅ Profile refreshed');
      }
    } catch (error) {
      console.error('❌ Error in refreshProfile:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [user]);

  // ============================================
  // دالة تحديث الملف الشخصي
  // ============================================
  const updateProfile = useCallback(async (data: Partial<Profile>) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      throw new Error('User not authenticated');
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...data } : null);
      
      toast.success('Profil mis à jour avec succès');
    } catch (error: any) {
      console.error('❌ Error updating profile:', error);
      toast.error('Erreur lors de la mise à jour du profil');
      throw error;
    }
  }, [user]);

  // ============================================
  // دالة تسجيل الدخول
  // ============================================
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (error) throw error;
      
      if (data.user) {
        setUser(data.user);
        const profileData = await fetchOrCreateProfile(
          data.user.id,
          data.user.email!,
          data.user.user_metadata?.full_name
        );
        setProfile(profileData);
        
        toast.success('تم تسجيل الدخول بنجاح');
        
        if (profileData?.role === 'admin' || profileData?.role === 'super_admin') {
          router.push('/admin');
        } else if (profileData?.role === 'driver') {
          router.push('/driver');
        } else {
          router.push('/');
        }
      }
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      toast.error(error.message || 'Erreur de connexion');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchOrCreateProfile, router]);

  // ============================================
  // دالة تسجيل الخروج
  // ============================================
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setProfile(null);
      isInitializedRef.current = false;
      
      toast.success('تم تسجيل الخروج بنجاح');
      router.push('/login');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      toast.error(error.message || 'Erreur de déconnexion');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // ============================================
  // دالة تسجيل مستخدم جديد
  // ============================================
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'customer',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: email.trim(),
            full_name: fullName.trim(),
            role: 'customer',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('❌ Error creating profile:', profileError);
          throw new Error('Erreur lors de la création du profil');
        }

        toast.success('Compte créé avec succès ! Veuillez vérifier votre email.');
        router.push('/login');
      }
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      toast.error(error.message || 'Erreur lors de l\'inscription');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // ============================================
  // ✅ INITIALISATION - حل الحلقة اللانهائية
  // ============================================
  useEffect(() => {
    mountedRef.current = true;
    
    // ✅ دالة التهيئة
    const initAuth = async () => {
      // ✅ منع التهيئة المتكررة
      if (isInitializedRef.current || !mountedRef.current) {
        console.log('⏳ Auth already initialized, skipping...');
        return;
      }
      
      try {
        setIsLoading(true);
        console.log('🔐 Initializing auth...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setIsLoading(false);
          return;
        }

        if (session?.user && mountedRef.current) {
          console.log('👤 User found:', session.user.email);
          setUser(session.user);
          
          const profileData = await fetchOrCreateProfile(
            session.user.id,
            session.user.email!,
            session.user.user_metadata?.full_name
          );
          
          if (mountedRef.current && profileData) {
            setProfile(profileData);
            isInitializedRef.current = true;
          }
        } else {
          console.log('ℹ️ No active session');
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // ✅ تأخير التهيئة لتجنب التحميل المتكرر
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }
    
    initTimeoutRef.current = setTimeout(initAuth, 100);

    // ✅ الاستماع لتغييرات المصادقة - مرة واحدة فقط
    if (!authListenerRef.current) {
      authListenerRef.current = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔐 Auth state changed:', event);
          
          if (!mountedRef.current) return;
          
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user);
            const profileData = await fetchOrCreateProfile(
              session.user.id,
              session.user.email!,
              session.user.user_metadata?.full_name
            );
            if (mountedRef.current && profileData) {
              setProfile(profileData);
              isInitializedRef.current = true;
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
            isInitializedRef.current = false;
          } else if (event === 'USER_UPDATED' && session?.user) {
            setUser(session.user);
            await refreshProfile();
          }
          
          if (mountedRef.current) {
            setIsLoading(false);
          }
        }
      );
    }

    // ✅ التنظيف عند إلغاء تثبيت المكون
    return () => {
      mountedRef.current = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (authListenerRef.current) {
        authListenerRef.current.data.subscription.unsubscribe();
        authListenerRef.current = null;
      }
    };
  }, []); // ✅ مصفوفة فارغة - يتم التنفيذ مرة واحدة فقط

  // ============================================
  // PROVIDER VALUE
  // ============================================
  const value: AuthContextType = {
    user,
    profile,
    isLoading,
    signIn,
    signOut,
    signUp,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser() {
  const { user, profile, isLoading } = useAuth();
  return { user, profile, isLoading };
}

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  return { user, isLoading };
}

export function useRequireRole(roles: ('customer' | 'driver' | 'admin' | 'super_admin')[]) {
  const { profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!profile || !roles.includes(profile.role))) {
      toast.error('Vous n\'avez pas les droits nécessaires');
      router.push('/');
    }
  }, [profile, isLoading, router, roles]);

  return { profile, isLoading };
}