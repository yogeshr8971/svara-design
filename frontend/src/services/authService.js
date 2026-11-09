import api from './api';

/** Login endpoints answer 403 VERIFICATION_REQUIRED for unfinished sign-ups; surface that as data, not an error. */
const withVerificationPassthrough = async (call) => {
  try {
    const { data } = await call();
    return data;
  } catch (err) {
    if (err.response?.data?.verificationRequired) return err.response.data;
    throw err;
  }
};

// Registration: step 1 (creates unverified account, sends email + SMS codes)
export const register = async (payload) => (await api.post('/auth/customer/register', payload)).data;
export const registerSeller = async (payload) => (await api.post('/auth/seller/register', payload)).data;
// Registration: step 2 (confirm both codes -> session)
export const verifyRegistration = async (body) => (await api.post('/auth/register/verify', body)).data;
export const resendRegistrationOtp = async (email, channel) =>
  (await api.post('/auth/register/resend', { email, channel })).data;

// Login: step 1 (password -> emails a code)
export const login = (email, password) =>
  withVerificationPassthrough(() => api.post('/auth/customer/login', { email, password }));
export const loginSeller = (email, password) =>
  withVerificationPassthrough(() => api.post('/auth/seller/login', { email, password }));
// Login: step 2 (code -> session)
export const verifyLogin = async (email, otp) => (await api.post('/auth/login/verify', { email, otp })).data;
export const resendLoginOtp = async (email) => (await api.post('/auth/login/resend', { email })).data;

// Session
export const getMe = async () => (await api.get('/auth/me')).data;
export const logout = async () => (await api.post('/auth/logout')).data;
export const logoutAll = async () => (await api.post('/auth/logout-all')).data;

// Profile
export const updateProfile = async (profileData) => (await api.put('/auth/profile', profileData)).data;

// Password Reset: step 1 (sends a 3-minute OTP to the account email)
export const forgotPassword = async (email) => (await api.post('/auth/forgot-password', { email })).data;
// Password Reset: step 2 (OTP + new password)
export const resetPassword = async (email, otp, newPassword) =>
  (await api.post('/auth/reset-password', { email, code: otp, password: newPassword, otp, newPassword })).data;
