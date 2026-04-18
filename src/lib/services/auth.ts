"use client";

// ============================================================
// auth.ts — Firebase Auth + Firestore RBAC
// All functions run client-side (no "use server").
// ============================================================

import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged as fbOnAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { Role, UserProfile, PermissionLevel, ModulePermissions } from '../types/user';

// Redundant types removed

// ── Helpers ──────────────────────────────────────────────────

const profileRef = (uid: string) => doc(db, 'userProfiles', uid);

// ── Auth Actions ─────────────────────────────────────────────

/** 登入 */
export const login = async (email: string, pass: string): Promise<UserProfile> => {
  const credential = await signInWithEmailAndPassword(auth, email, pass);
  let profile = await getUserProfile(credential.user.uid);
  
  if (!profile) {
    // 特殊處理：如果是預設管理員帳號但丟失了 Firestore 資料，自動修復
    if (email === 'admin@7th.com') {
      const newProfile: Omit<UserProfile, 'uid'> = {
        email: email,
        name: '系統管理員 (自動修復)',
        role: 'ADMIN',
        permissions: { 
          finance: 'EDIT', schedule: 'EDIT', database: 'EDIT', 
          holidays: 'EDIT', portal: 'EDIT', settings: 'EDIT', ledger: 'EDIT' 
        }
      };
      await setDoc(profileRef(credential.user.uid), newProfile);
      profile = { uid: credential.user.uid, ...newProfile } as UserProfile;
      return profile;
    }
    throw new Error(`找到帳號但無權限資料 (UID: ${credential.user.uid.substring(0,6)}...)，請聯繫管理員或點擊下方的初始化按鈕。`);
  }
  return profile;
};

/** Google 登入 */
export const loginWithGoogle = async (): Promise<UserProfile> => {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  let profile = await getUserProfile(credential.user.uid);
  
  // 如果是第一次 Google 登入，自動建立一個基礎 Profile
  if (!profile) {
    const newProfile: Omit<UserProfile, 'uid'> = {
      email: credential.user.email,
      name: credential.user.displayName || 'Google 用戶',
      role: 'ADMIN', // 首次登入預設給 ADMIN (方便初始開發)，之後可改
      permissions: { 
        finance: 'EDIT', schedule: 'EDIT', database: 'EDIT', 
        holidays: 'EDIT', portal: 'EDIT', settings: 'EDIT', ledger: 'EDIT' 
      }
    };
    await setDoc(profileRef(credential.user.uid), newProfile);
    profile = { uid: credential.user.uid, ...newProfile } as UserProfile;
  }
  return profile;
};

/** 登出 */
export const logout = async () => {
  await signOut(auth);
};

/** 取得當前登入使用者的 Profile */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
};

/** 取得 Session (client-side: 從 Firebase Auth 取得當前 user) */
export const getSession = async (): Promise<UserProfile | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return getUserProfile(user.uid);
};

/** Firebase Auth 狀態監聽 (給 AuthProvider 用) */
export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return fbOnAuthStateChanged(auth, callback);
};

/** 管理者建立新帳號 */
export const createUser = async (
  email: string,
  pass: string,
  role: string,
  permissions: ModulePermissions,
  name?: string,
  teacherId?: string,
) => {
  const credential = await createUserWithEmailAndPassword(auth, email, pass);
  const profile: Omit<UserProfile, 'uid'> = {
    email,
    name: name || '',
    role: role as Role,
    permissions,
    teacherId,
  };
  await setDoc(profileRef(credential.user.uid), profile);
  return { uid: credential.user.uid, ...profile };
};

/** 初始化管理者 (首次啟動) - 直接在 Firestore 建立資料 */
export const initializeAdmin = async () => {
  const email = 'admin@7th.com';
  const pass = 'admin777';
  const permissions: ModulePermissions = {
    finance: 'EDIT',
    schedule: 'EDIT',
    database: 'EDIT',
    holidays: 'EDIT',
    portal: 'EDIT',
    settings: 'EDIT',
    ledger: 'EDIT',
  };

  try {
    // 先嘗試登入看看，如果失敗再建立
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await getUserProfile(cred.user.uid);
      if (!profile) {
        await setDoc(profileRef(cred.user.uid), { email, name: '系統管理員', role: 'ADMIN', permissions });
      }
      return { success: true, message: '管理員已就緒' };
    } catch (e) {
      // 登入失敗代表帳號可能不存在，嘗試建立
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(profileRef(credential.user.uid), {
        email,
        name: '系統管理員',
        role: 'ADMIN',
        permissions,
      });
      return { success: true, message: '管理員帳號建立成功' };
    }
  } catch (err: any) {
    throw err;
  }
};

/** 儲存 / 更新 UserProfile */
export const saveUserProfile = async (profile: UserProfile) => {
  const { uid, ...rest } = profile;
  await updateDoc(profileRef(uid), rest as any);
};

/** 取得所有使用者 Profiles (管理頁用) */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(collection(db, 'userProfiles'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
};

/** 重設密碼 (發送 Email) */
export const resetPassword = async (uid: string, newPass: string) => {
  // Firebase Admin SDK needed for direct password reset;
  // client-side we use sendPasswordResetEmail or re-auth approach.
  // For admin use: find the user's email then send reset email.
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) throw new Error('找不到使用者');
  const email = snap.data().email as string;
  await sendPasswordResetEmail(auth, email);
};
/** 取得補全預設值的權限物件 (用於處理新模組與舊帳號同步) */
export const getModulePermissionsWithDefaults = (
  existing: Partial<ModulePermissions> = {}, 
  role: Role
): ModulePermissions => {
  const { SYSTEM_MODULES } = require('../constants/modules');
  const result: ModulePermissions = {};
  
  SYSTEM_MODULES.forEach((m: any) => {
    // 如果已有設定則沿用，否則根據角色賦予預設
    if (existing[m.id]) {
      result[m.id] = existing[m.id]!;
    } else {
      result[m.id] = (role === 'ADMIN') ? 'EDIT' : 'NONE';
    }
  });

  return result;
};
