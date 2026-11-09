import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Validate session on app startup
  useEffect(() => {
    const validateSession = async () => {
      try {
        const data = await authService.getMe();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('svara_user', JSON.stringify(data.user));
        }
      } catch {
        // Never treat a cached profile as an authenticated session.
        localStorage.removeItem('svara_user');
        localStorage.removeItem('svara_token');
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  const establish = useCallback((data) => {
    if (data?.token) {
      localStorage.setItem('svara_token', data.token);
    }
    if (data?.user) {
      localStorage.setItem('svara_user', JSON.stringify(data.user));
      setUser(data.user);
    }
    return data;
  }, []);

  // Step 1 of sign-in/sign-up returns { otpRequired | verificationRequired } and does NOT sign the user in.
  // Only when the server returns a user (LOGIN_EMAIL_OTP=false) do we establish the session here.
  const login = useCallback(async (email, password) => establish(await authService.login(email, password)), [establish]);
  const loginSeller = useCallback(async (email, password) => establish(await authService.loginSeller(email, password)), [establish]);

  const register = useCallback(async (userDataOrName, email, password) => {
    const payload = typeof userDataOrName === 'object' ? userDataOrName : { name: userDataOrName, email, password };
    return authService.register(payload);
  }, []);
  const registerSeller = useCallback((sellerData) => authService.registerSeller(sellerData), []);

  // Step 2: these actually sign the user in.
  const verifyLogin = useCallback(async (email, otp) => establish(await authService.verifyLogin(email, otp)), [establish]);
  const verifyRegistration = useCallback(async (body) => establish(await authService.verifyRegistration(body)), [establish]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Logout should always clear local state even if API fails
    }
    localStorage.removeItem('svara_user');
    localStorage.removeItem('svara_token');
    setUser(null);
  }, []);

  const updateUser = useCallback((updated) => {
    setUser(updated);
    localStorage.setItem('svara_user', JSON.stringify(updated));
  }, []);

  const isAdmin = user?.role === 'admin';
  const isSeller = user?.role === 'seller';
  const isSellerOrAdmin = isAdmin || isSeller;
  const sellerStatus = user?.sellerStatus || 'none';
  const isActiveSeller = isSeller && sellerStatus === 'active';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginSeller,
        register,
        registerSeller,
        verifyLogin,
        verifyRegistration,
        logout,
        updateUser,
        isAdmin,
        isSeller,
        isActiveSeller,
        isSellerOrAdmin,
        sellerStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
