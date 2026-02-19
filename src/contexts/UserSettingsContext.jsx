import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getJson, patchJson } from '../api/http';
import { useAuth } from './AuthContext';

const UserSettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  language: 'English',
  time_zone: '',
  date_format: 'mdy',
  start_dashboard_view: 'dashboard',
  auto_save_edits: true,
  email_digest_enabled: true,

  notification_preferences: {
    compliance_alerts: true,
    messages: true,
    ai_tips: false,
  },
  calendar_sync: 'Google Calendar',

  font_size: 'Medium',
  high_contrast_mode: false,
  screen_reader_compatible: true,
};

function normalizeSettings(raw) {
  const s = raw || {};
  const notif = (s?.notification_preferences && typeof s.notification_preferences === 'object')
    ? s.notification_preferences
    : {};

  const notification_preferences = {
    compliance_alerts: Boolean(notif?.compliance_alerts ?? notif?.complianceAlerts ?? true),
    messages: Boolean(notif?.messages ?? true),
    ai_tips: Boolean(notif?.ai_tips ?? notif?.aiTips ?? false),
  };

  return {
    language: s?.language || 'English',
    time_zone: s?.time_zone || '',
    date_format: (s?.date_format === 'dmy' ? 'dmy' : 'mdy'),
    start_dashboard_view: s?.start_dashboard_view || 'dashboard',
    auto_save_edits: s?.auto_save_edits !== false,
    email_digest_enabled: s?.email_digest_enabled !== false,

    notification_preferences,
    calendar_sync: s?.calendar_sync || 'Google Calendar',

    font_size: (s?.font_size === 'Small' || s?.font_size === 'Large') ? s.font_size : 'Medium',
    high_contrast_mode: Boolean(s?.high_contrast_mode ?? false),
    screen_reader_compatible: s?.screen_reader_compatible !== false,
  };
}

function storageKey(uid) {
  return uid ? `fp_user_settings_v1:${uid}` : 'fp_user_settings_v1:anon';
}

export function UserSettingsProvider({ children }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Apply accessibility settings globally.
  useEffect(() => {
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle('fp-high-contrast', Boolean(settings?.high_contrast_mode));

    root.classList.remove('fp-font-small', 'fp-font-medium', 'fp-font-large');
    const size = settings?.font_size;
    if (size === 'Small') root.classList.add('fp-font-small');
    else if (size === 'Large') root.classList.add('fp-font-large');
    else root.classList.add('fp-font-medium');
  }, [settings?.high_contrast_mode, settings?.font_size]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Bootstrap from localStorage quickly, then refresh from API.
  useEffect(() => {
    let cancelled = false;
    const key = storageKey(uid);

    const readCached = () => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return normalizeSettings(JSON.parse(raw));
      } catch {
        return null;
      }
    };

    const cached = readCached();
    if (cached) setSettings(cached);

    (async () => {
      if (!uid) {
        if (!cancelled) {
          setSettings(DEFAULT_SETTINGS);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const remote = await getJson('/auth/settings', { requestLabel: 'GET /auth/settings' });
        const normalized = normalizeSettings(remote);
        if (cancelled) return;
        setSettings(normalized);
        try { localStorage.setItem(key, JSON.stringify(normalized)); } catch {}
      } catch (e) {
        // Best-effort: keep cached/default.
        if (!cancelled) {
          // still mark loaded so UI can proceed
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uid]);

  const refreshSettings = useCallback(async () => {
    if (!uid) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return DEFAULT_SETTINGS;
    }

    setLoading(true);
    try {
      const remote = await getJson('/auth/settings', { requestLabel: 'GET /auth/settings' });
      const normalized = normalizeSettings(remote);
      setSettings(normalized);
      try { localStorage.setItem(storageKey(uid), JSON.stringify(normalized)); } catch {}
      return normalized;
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [uid]);

  const patchSettings = useCallback(async (partial, options = {}) => {
    if (!uid) return DEFAULT_SETTINGS;
    const updated = await patchJson('/auth/settings', partial, {
      requestLabel: options.requestLabel || 'PATCH /auth/settings',
      timeoutMs: options.timeoutMs ?? 25000,
    });
    const normalized = normalizeSettings(updated);
    setSettings(normalized);
    try { localStorage.setItem(storageKey(uid), JSON.stringify(normalized)); } catch {}
    return normalized;
  }, [uid]);

  const setSettingsSafe = useCallback((next) => {
    const normalized = normalizeSettings(next);
    setSettings(normalized);
    if (uid) {
      try { localStorage.setItem(storageKey(uid), JSON.stringify(normalized)); } catch {}
    }
  }, [uid]);

  const value = useMemo(() => ({
    settings,
    loading,
    refreshSettings,
    patchSettings,
    setSettings: setSettingsSafe,
  }), [settings, loading, refreshSettings, patchSettings, setSettingsSafe]);

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      loading: false,
      refreshSettings: async () => DEFAULT_SETTINGS,
      patchSettings: async () => DEFAULT_SETTINGS,
      setSettings: () => {},
    };
  }
  return ctx;
}
