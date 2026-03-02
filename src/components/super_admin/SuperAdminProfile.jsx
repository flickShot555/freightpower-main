import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from 'firebase/auth';
import { auth } from '../../firebase';
import { API_URL } from '../../config';
import Toast from '../common/Toast';

export default function SuperAdminProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  const [profile, setProfile] = useState({ uid: '', name: '', email: '', photo_url: '' });
  const [form, setForm] = useState({ name: '', email: '', photo_url: '', new_password: '' });
  const [selectedFile, setSelectedFile] = useState(null);

  const changedPayload = useMemo(() => {
    const payload = {};
    if (form.name !== profile.name) payload.name = form.name;
    if (form.email !== profile.email) payload.email = form.email;
    if ((form.photo_url || '') !== (profile.photo_url || '')) payload.photo_url = form.photo_url || null;
    if (form.new_password) payload.new_password = form.new_password;
    return payload;
  }, [form, profile]);

  useEffect(() => {
    const run = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate('/super-admin/login', { replace: true });
          return;
        }

        const idToken = await getIdToken(user);
        const resp = await fetch(`${API_URL}/auth/super-admin/profile`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.detail || 'Failed to load profile');

        setProfile({
          uid: data.uid,
          name: data.name || '',
          email: data.email || '',
          photo_url: data.photo_url || '',
        });
        setForm({
          name: data.name || '',
          email: data.email || '',
          photo_url: data.photo_url || '',
          new_password: '',
        });
      } catch (e) {
        console.error(e);
        setToast({ type: 'error', message: e?.message || 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [navigate]);

  const handleSave = async () => {
    setToast(null);
    if (!Object.keys(changedPayload).length) {
      setToast({ type: 'success', message: 'No changes to save.' });
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      const idToken = await getIdToken(user);
      const resp = await fetch(`${API_URL}/auth/super-admin/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(changedPayload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.detail || 'Save failed');

      setToast({ type: 'success', message: 'Profile updated.' });
      const nextProfile = {
        ...profile,
        ...('name' in changedPayload ? { name: changedPayload.name } : {}),
        ...('email' in changedPayload ? { email: changedPayload.email } : {}),
        ...('photo_url' in changedPayload ? { photo_url: changedPayload.photo_url } : {}),
      };
      setProfile(nextProfile);
      setForm((s) => ({ ...s, new_password: '' }));
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAvatar = async () => {
    setToast(null);
    if (!selectedFile) {
      setToast({ type: 'error', message: 'Please select an image first.' });
      return;
    }

    setUploading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      // Basic client-side validation
      if (!String(selectedFile.type || '').startsWith('image/')) {
        throw new Error('Please select an image file.');
      }

      const idToken = await getIdToken(user);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const resp = await fetch(`${API_URL}/auth/profile/picture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.detail || data?.message || 'Failed to upload profile picture');

      const url = data?.profile_picture_url;
      if (url) {
        // Backend also syncs super_admins.photo_url for super admins.
        setProfile((p) => ({ ...p, photo_url: url }));
        setForm((s) => ({ ...s, photo_url: url }));
      }
      setSelectedFile(null);
      setToast({ type: 'success', message: 'Profile picture updated.' });
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>Loading profile…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: 24 }}>
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Super Admin Profile</h2>
          <button
            onClick={() => navigate('/super-admin/dashboard')}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}
          >
            Back to Dashboard
          </button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, boxShadow: '0 12px 30px rgba(16,24,40,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <img
              src={form.photo_url || 'https://www.gravatar.com/avatar/?d=mp'}
              alt="avatar"
              style={{ width: 58, height: 58, borderRadius: 14, objectFit: 'cover', border: '1px solid #e5e7eb' }}
            />
            <div>
              <div style={{ fontWeight: 800 }}>{profile.name || 'Super Admin'}</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{profile.email}</div>
            </div>
          </div>

          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Upload Profile Picture</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              style={{ flex: '1 1 240px' }}
            />
            <button
              onClick={handleUploadAvatar}
              disabled={uploading || !selectedFile}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: 'pointer',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>

          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12 }}
          />

          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Email</label>
          <input
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            type="email"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12 }}
            autoComplete="username"
          />

          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Profile Picture URL (optional)</label>
          <input
            value={form.photo_url}
            onChange={(e) => setForm((s) => ({ ...s, photo_url: e.target.value }))}
            placeholder="https://…"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12 }}
          />

          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>New Password</label>
          <input
            value={form.new_password}
            onChange={(e) => setForm((s) => ({ ...s, new_password: e.target.value }))}
            type="password"
            placeholder="Leave blank to keep current"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 16 }}
            autoComplete="new-password"
          />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              disabled={saving}
              onClick={handleSave}
              style={{ padding: '12px 14px', borderRadius: 12, border: 'none', background: '#111827', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          <div style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>
            Changing email/password updates Firebase Auth. You may need to sign in again if your session becomes stale.
          </div>
        </div>
      </div>
    </div>
  );
}
