"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { createUserProfile, getMe, type UserProfile } from "./users";

type SignupData = {
  name: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  /* Admin status is resolved server-side and arrives with the profile, so the
     console gate doesn't need a second round trip to find out. */
  isAdmin: boolean;
  /* True when the last profile load FAILED, as opposed to succeeding and
     finding nothing. The two must never be conflated: treating an unreachable
     database as "you have no account" bounces a signed-in admin out of the
     console and makes them log in again for no reason. */
  profileError: boolean;
  /* What actually went wrong, when something did. The boolean alone made every
     failure look identical, so a 403 the visitor could act on and a genuine
     outage both rendered as "this is usually temporary" - and the visitor
     retried forever on something retrying could never fix. */
  profileErrorMessage: string | null;
  /* Firebase's own record, mirrored into state (not just read off `user`) so
     that re-checking it after the visitor clicks the email link can trigger a
     re-render — reloading a Firebase User mutates the same object in place,
     which React's Object.is check would otherwise treat as no change. */
  emailVerified: boolean;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  /** Sends a password-reset link to the given email, if an account exists. */
  resetPassword: (email: string) => Promise<void>;
  /** Re-sends the verification email to the signed-in user. */
  resendVerificationEmail: () => Promise<void>;
  /** Reloads the signed-in user from Firebase and returns the fresh
   *  emailVerified value — call after they say they've clicked the link. */
  checkEmailVerified: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setEmailVerified(u?.emailVerified ?? false);
      setLoading(false);
    });
  }, []);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      setIsAdmin(false);
      setProfileError(false);
      setProfileErrorMessage(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const me = await getMe();
      setProfile(me.profile);
      setIsAdmin(me.isAdmin);
      setProfileError(false);
      setProfileErrorMessage(null);
    } catch (err) {
      /* Never leave a stale isAdmin=true behind on a failed refresh — that
         would be a privilege decision made on stale data. But do record that
         this was a failure, so the gates can offer a retry instead of
         concluding the account doesn't exist. */
      setProfile(null);
      setIsAdmin(false);
      setProfileError(true);
      setProfileErrorMessage(
        err instanceof Error && err.message ? err.message : null,
      );
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Load the profile from /api/me whenever the signed-in user changes.
  useEffect(() => {
    if (loading) return;
    loadProfile(user);
  }, [user, loading, loadProfile]);

  const value: AuthContextValue = {
    user,
    loading,
    profile,
    profileLoading,
    isAdmin,
    profileError,
    profileErrorMessage,
    emailVerified,
    refreshProfile: () => loadProfile(user),
    login: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signup: async (email, password, data) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: data.name });
      /* From here the account genuinely exists, so a failure below must not be
         reported as "couldn't create your account" — retrying would only hit
         "email already in use". If the profile write doesn't land, GET /api/me
         recreates the row from the token on the next load. */
      await createUserProfile(cred.user.uid, { name: data.name, email }).catch(
        () => {},
      );
      /* Best-effort: a bounced/rate-limited verification email shouldn't block
         account creation. The dashboard gate's "Resend" button covers a real
         send failure, and DashboardGate.tsx blocks real use until this lands
         and is clicked either way. */
      await sendEmailVerification(cred.user).catch(() => {});
      await loadProfile(cred.user);
    },
    logout: async () => {
      await signOut(auth);
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },
    resendVerificationEmail: async () => {
      if (!auth.currentUser) throw new Error("Not signed in.");
      await sendEmailVerification(auth.currentUser);
    },
    checkEmailVerified: async () => {
      if (!auth.currentUser) return false;
      await auth.currentUser.reload();
      const verified = auth.currentUser.emailVerified;
      /* Force a new ID token once it flips.
       *
       * reload() updates the SDK's user object, not the cached token, and
       * getIdToken() keeps serving that cache until it nears expiry — up to
       * an hour. The server reads email_verified from the token, so without
       * this the browser believes the account is verified while every
       * request still says otherwise: requireVerifiedUid refuses the first
       * submission, and GET /api/me declines to create the recruiter row. */
      if (verified) await auth.currentUser.getIdToken(true);
      setEmailVerified(verified);
      return verified;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
