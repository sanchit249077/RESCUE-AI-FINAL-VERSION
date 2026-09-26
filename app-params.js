export const appParams = {
  appId: 'rescueai-local',
  token: typeof window !== 'undefined' ? localStorage.getItem('base44_access_token') : null,
};
