// lib/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase/client';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'driver' | 'admin' | 'super_admin';
  phone?: string;
  avatar_url?: string;
  driver_id?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // جلب ملف تعريف المستخدم مع إنشائه تلقائياً إذا لم يكن موجوداً
  const fetchOrCreateProfile = async (userId: string, email: string, fullName?: string) => {
    try {
      // 1. محاولة جلب الملف الشخصي
      let { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // 2. إذا لم يكن موجوداً، قم بإنشائه
      if (error && error.code === 'PGRST116') {
        console.log('🔄 Profile not found, creating...');
        
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: email,
            full_name: fullName || email.split('@')[0] || 'مستخدم',
            role: 'customer',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating profile:', insertError);
          return null;
        }

        console.log('✅ Profile created:', newProfile);
        return newProfile;
      }

      if (error) {
        console.error('❌ Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in fetchOrCreateProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. الحصول على الجلسة الحالية
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // 2. جلب أو إنشاء الملف الشخصي
          const profileData = await fetchOrCreateProfile(
            session.user.id,
            session.user.email!,
            session.user.user_metadata?.full_name
          );
          
          setProfile(profileData);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // الاستماع لتغييرات المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchOrCreateProfile(
            session.user.id,
            session.user.email!,
            session.user.user_metadata?.full_name
          );
          setProfile(profileData);
        } else {
          setUser(null);
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // تسجيل الدخول
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    if (data.user) {
      const profileData = await fetchOrCreateProfile(
        data.user.id,
        data.user.email!,
        data.user.user_metadata?.full_name
      );
      setProfile(profileData);
    }
  };

  // تسجيل الخروج
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  };

  // تسجيل مستخدم جديد
  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'customer',
        },
      },
    });
    if (error) throw error;

    if (data.user) {
      // إنشاء ملف تعريف للمستخدم الجديد
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          role: 'customer',
        });
      if (profileError) throw profileError;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        signIn,
        signOut,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
