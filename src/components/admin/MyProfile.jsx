import { useUserSettings } from '../../contexts/UserSettingsContext';
import { formatDateTime } from '../../utils/dateTimeFormat';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/admin/MyProfile.css';
import Toast from '../common/Toast';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import {
	clearTrustedDeviceToken,
	getOrCreateTrustedDeviceId,
	getTrustedDeviceToken,
	setTrustedDeviceToken,
} from '../../utils/trustedDevice';
import { forceLogoutToLogin, getSessionId, isSessionRevokedMessage } from '../../utils/session';

export default function MyProfile() {
		const { settings } = useUserSettings();
	const { currentUser } = useAuth();
	const [toast, setToast] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploadingAvatar, setUploadingAvatar] = useState(false);
	const [profile, setProfile] = useState(null);
	const [sessions, setSessions] = useState([]);
	const [loadingSessions, setLoadingSessions] = useState(false);
	const fileInputRef = useRef(null);
	const [draft, setDraft] = useState({
		name: '',
		email: '',
		role: 'admin',
		phone: '',
		department: '',
		time_zone: '',
		utc_offset_minutes: null,
		language: 'English (EN)',
		location: '',
		gps_lat: null,
		gps_lng: null,
		show_email_internal_only: true,
		mfa_enabled: false,
		trusted_devices_enabled: false,
	});

	const deviceTimeZone = useMemo(() => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
		} catch {
			return '';
		}
	}, []);

	const formatUtcOffset = (minutesAheadOfUtc) => {
		if (minutesAheadOfUtc === null || minutesAheadOfUtc === undefined || Number.isNaN(Number(minutesAheadOfUtc))) return '';
		const total = Math.trunc(Number(minutesAheadOfUtc));
		const sign = total >= 0 ? '+' : '-';
		const abs = Math.abs(total);
		const hh = String(Math.floor(abs / 60)).padStart(2, '0');
		const mm = String(abs % 60).padStart(2, '0');
		return `UTC${sign}${hh}:${mm}`;
	};

	const useDeviceUtcOffset = () => {
		try {
			// JS returns minutes BEHIND UTC; store minutes AHEAD of UTC for readability.
			const minutesAhead = -new Date().getTimezoneOffset();
			setDraft((d) => ({ ...d, utc_offset_minutes: minutesAhead }));
			setToast({ type: 'success', message: `UTC offset set to ${formatUtcOffset(minutesAhead)}` });
		} catch {
			setToast({ type: 'error', message: 'Unable to read UTC offset' });
		}
	};

	const useCurrentGps = () => {
		setToast(null);
		if (!('geolocation' in navigator)) {
			setToast({ type: 'error', message: 'Geolocation not supported in this browser' });
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const lat = pos?.coords?.latitude;
				const lng = pos?.coords?.longitude;
				if (typeof lat !== 'number' || typeof lng !== 'number') {
					setToast({ type: 'error', message: 'Unable to read GPS coordinates' });
					return;
				}
				const locStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
				setDraft((d) => ({
					...d,
					gps_lat: lat,
					gps_lng: lng,
					location: d.location?.trim() ? d.location : locStr,
				}));
				setToast({ type: 'success', message: 'GPS location captured' });
			},
			(err) => {
				console.error(err);
				setToast({ type: 'error', message: 'Location permission denied or unavailable' });
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
		);
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (!currentUser) {
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const token = await currentUser.getIdToken();
				const resp = await fetch(`${API_URL}/auth/me`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const data = await resp.json().catch(() => ({}));
				if (!resp.ok) throw new Error(data?.detail || 'Failed to load profile');
				if (cancelled) return;
				setProfile(data);
				setDraft({
					name: data?.name || '',
					email: data?.email || '',
					role: data?.role || 'admin',
					phone: data?.phone || '',
					department: data?.department || '',
					time_zone: data?.time_zone || deviceTimeZone,
					utc_offset_minutes: (data?.utc_offset_minutes ?? null),
					language: data?.language || 'English (EN)',
					location: data?.location || '',
					gps_lat: (data?.gps_lat ?? null),
					gps_lng: (data?.gps_lng ?? null),
					show_email_internal_only: data?.show_email_internal_only !== false,
					mfa_enabled: data?.mfa_enabled === true,
					trusted_devices_enabled: data?.trusted_devices_enabled === true,
				});
			} catch (e) {
				console.error(e);
				setToast({ type: 'error', message: e?.message || 'Failed to load profile' });
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [currentUser, deviceTimeZone]);

	const formatWhen = (ts) => {
		const n = Number(ts);
		if (!Number.isFinite(n) || n <= 0) return '';
		try {
			return formatDateTime(n, settings);
		} catch {
			return '';
		}
	};

	const loadSessions = async () => {
		if (!currentUser) return;
		setLoadingSessions(true);
		try {
			const token = await currentUser.getIdToken();
			const sessionId = getSessionId();
			const resp = await fetch(`${API_URL}/auth/admin/sessions`, {
				headers: {
					Authorization: `Bearer ${token}`,
					...(sessionId ? { 'X-Session-Id': sessionId } : {}),
				},
			});
			const data = await resp.json().catch(() => ({}));
			if (!resp.ok) {
				const detail = data?.detail || 'Failed to load sessions';
				if (isSessionRevokedMessage(detail)) {
					forceLogoutToLogin('session_revoked');
					return;
				}
				throw new Error(detail);
			}
			setSessions(Array.isArray(data?.items) ? data.items : []);
		} catch (e) {
			console.error(e);
			setToast((prev) => (prev?.type === 'error' ? prev : { type: 'error', message: e?.message || 'Failed to load login activity' }));
		} finally {
			setLoadingSessions(false);
		}
	};

	useEffect(() => {
		loadSessions();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser]);

	const signOutOtherDevices = async () => {
		setToast(null);
		if (!currentUser) {
			setToast({ type: 'error', message: 'Not signed in' });
			return;
		}
		const sessionId = getSessionId();
		if (!sessionId) {
			setToast({ type: 'error', message: 'Missing session id. Please log in again.' });
			return;
		}
		try {
			const token = await currentUser.getIdToken();
			const resp = await fetch(`${API_URL}/auth/admin/sessions/revoke-others`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
					'X-Session-Id': sessionId,
				},
				body: JSON.stringify({ current_session_id: sessionId }),
			});
			const data = await resp.json().catch(() => ({}));
			if (!resp.ok) throw new Error(data?.detail || 'Failed to sign out other devices');
			setToast({ type: 'success', message: `Signed out ${Number(data?.revoked || 0)} device(s)` });
			await loadSessions();
		} catch (e) {
			console.error(e);
			setToast({ type: 'error', message: e?.message || 'Failed to sign out other devices' });
		}
	};

	const onCancel = () => {
		if (!profile) return;
		setDraft({
			name: profile?.name || '',
			email: profile?.email || '',
			role: profile?.role || 'admin',
			phone: profile?.phone || '',
			department: profile?.department || '',
			time_zone: profile?.time_zone || deviceTimeZone,
			utc_offset_minutes: (profile?.utc_offset_minutes ?? null),
			language: profile?.language || 'English (EN)',
			location: profile?.location || '',
			gps_lat: (profile?.gps_lat ?? null),
			gps_lng: (profile?.gps_lng ?? null),
			show_email_internal_only: profile?.show_email_internal_only !== false,
			mfa_enabled: profile?.mfa_enabled === true,
			trusted_devices_enabled: profile?.trusted_devices_enabled === true,
		});
		setToast({ type: 'info', message: 'Changes discarded' });
	};

	const onSave = async () => {
		setToast(null);
		if (!currentUser) {
			setToast({ type: 'error', message: 'Not signed in' });
			return;
		}
		if (!draft.name.trim()) {
			setToast({ type: 'error', message: 'Full name is required' });
			return;
		}

		setSaving(true);
		try {
			const token = await currentUser.getIdToken();

			// Save profile fields
			const resp = await fetch(`${API_URL}/auth/profile/update`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: draft.name.trim(),
					phone: draft.phone.trim() || null,
					department: draft.department.trim() || null,
					time_zone: draft.time_zone.trim() || null,
					utc_offset_minutes: (draft.utc_offset_minutes ?? null),
					language: draft.language.trim() || null,
					location: draft.location.trim() || null,
					gps_lat: (draft.gps_lat ?? null),
					gps_lng: (draft.gps_lng ?? null),
					trusted_devices_enabled: !!draft.trusted_devices_enabled,
					show_email_internal_only: !!draft.show_email_internal_only,
				}),
			});
			const data = await resp.json().catch(() => ({}));
			if (!resp.ok) throw new Error(data?.detail || data?.message || 'Failed to save profile');

			// Save MFA toggle if changed
			if (profile?.mfa_enabled !== draft.mfa_enabled) {
				const mfaResp = await fetch(`${API_URL}/auth/mfa-toggle`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ enable: !!draft.mfa_enabled, method: 'email' }),
				});
				const mfaData = await mfaResp.json().catch(() => ({}));
				if (!mfaResp.ok) throw new Error(mfaData?.detail || 'Failed to update MFA setting');
			}

			// If trusted devices enabled, register this browser and store token.
			// If disabled, revoke this browser token (best-effort).
			try {
				const deviceId = getOrCreateTrustedDeviceId();
				if (draft.trusted_devices_enabled) {
					if (!getTrustedDeviceToken()) {
						const tdResp = await fetch(`${API_URL}/auth/admin/trusted-devices/register`, {
							method: 'POST',
							headers: {
								Authorization: `Bearer ${token}`,
								'X-Trusted-Device-Id': deviceId,
							},
						});
						const tdData = await tdResp.json().catch(() => ({}));
						if (tdResp.ok && tdData?.trusted_device_token) {
							setTrustedDeviceToken(tdData.trusted_device_token);
							setToast({ type: 'success', message: 'This device is now trusted' });
						}
					}
				} else {
					if (getTrustedDeviceToken()) {
						await fetch(`${API_URL}/auth/admin/trusted-devices/revoke`, {
							method: 'POST',
							headers: {
								Authorization: `Bearer ${token}`,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ device_id: deviceId }),
						});
						clearTrustedDeviceToken();
					}
				}
			} catch (e) {
				console.warn('Trusted device update failed', e);
			}

			// Refresh profile
			const meResp = await fetch(`${API_URL}/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const me = await meResp.json().catch(() => ({}));
			if (meResp.ok) {
				setProfile(me);
				setDraft((d) => ({
					...d,
					mfa_enabled: me?.mfa_enabled === true,
					show_email_internal_only: me?.show_email_internal_only !== false,
					trusted_devices_enabled: me?.trusted_devices_enabled === true,
				}));
			}

			setToast({ type: 'success', message: 'Profile saved' });
		} catch (e) {
			console.error(e);
			setToast({ type: 'error', message: e?.message || 'Failed to save profile' });
		} finally {
			setSaving(false);
		}
	};

	const pickAvatarFile = () => {
		try {
			fileInputRef.current?.click();
		} catch {
			// ignore
		}
	};

	const uploadAvatar = async (file) => {
		setToast(null);
		if (!currentUser) {
			setToast({ type: 'error', message: 'Not signed in' });
			return;
		}
		if (!file) return;
		if (!String(file.type || '').startsWith('image/')) {
			setToast({ type: 'error', message: 'Please select an image file' });
			return;
		}

		setUploadingAvatar(true);
		try {
			const token = await currentUser.getIdToken();
			const formData = new FormData();
			formData.append('file', file);

			const resp = await fetch(`${API_URL}/auth/profile/picture`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: formData,
			});
			const data = await resp.json().catch(() => ({}));
			if (!resp.ok) throw new Error(data?.detail || data?.message || 'Failed to upload profile picture');

			const url = data?.profile_picture_url;
			if (url) {
				setProfile((p) => ({ ...(p || {}), profile_picture_url: url }));
			}
			setToast({ type: 'success', message: 'Profile picture updated' });
		} catch (e) {
			console.error(e);
			setToast({ type: 'error', message: e?.message || 'Upload failed' });
		} finally {
			setUploadingAvatar(false);
		}
	};

	return (
		<div className="my-profile-root">
			<Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
			<header className="fp-header">
				<div className="fp-header-titles">
					<h2>My Profile</h2>
					<p className="fp-subtitle">
						Role: {draft.department || 'Admin'} · {loading ? 'Loading…' : 'Profile synced'}
					</p>
				</div>
			</header>

			<div className="profile-top-grid">
				<div className="card profile-card">
					<div className="card-header"><h3> Personal Details</h3></div>
                    <div className="profile-avatar-big">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								hidden
								onChange={(e) => {
									const f = e.target.files?.[0] || null;
									// allow selecting the same file twice
									e.target.value = '';
									if (f) uploadAvatar(f);
								}}
							/>
							<div className="avatar-frame" role="button" tabIndex={0} onClick={pickAvatarFile} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pickAvatarFile()}>
								<img src={profile?.profile_picture_url || 'https://randomuser.me/api/portraits/lego/2.jpg'} alt="avatar" />
							</div>
							<div className="upload-text">{uploadingAvatar ? 'Uploading…' : 'Click to upload new photo'}</div>
						</div>
					<div className="profile-card-body">

						<div className="profile-fields">
							<label>Full Name</label>
							<input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} disabled={loading} />

							<label>Role</label>
							<input value={(draft.role || 'admin').toString()} disabled />

							<label>Email Address</label>
							<input value={draft.email} disabled />

							<label>Phone Number</label>
							<input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} disabled={loading} />

							<label>Department / Team</label>
							<select value={draft.department} onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))} disabled={loading}>
								<option value="">Select department</option>
								<option value="Compliance & Operations">Compliance & Operations</option>
								<option value="Billing">Billing</option>
								<option value="Support">Support</option>
							</select>

							<label>Time Zone</label>
							<div className="location-row">
								<input value={draft.time_zone} onChange={(e) => setDraft((d) => ({ ...d, time_zone: e.target.value }))} disabled={loading} />
								<button className="btn small ghost-cd" type="button" onClick={() => setDraft((d) => ({ ...d, time_zone: deviceTimeZone }))} disabled={loading || !deviceTimeZone}>
									Use device TZ
								</button>
							</div>

										<label>UTC Offset</label>
										<div className="location-row">
											<input
												value={draft.utc_offset_minutes === null || draft.utc_offset_minutes === undefined ? '' : String(draft.utc_offset_minutes)}
												onChange={(e) => {
													const raw = e.target.value;
													const parsed = raw.trim() === '' ? null : Number(raw);
													setDraft((d) => ({ ...d, utc_offset_minutes: Number.isFinite(parsed) ? Math.trunc(parsed) : d.utc_offset_minutes }));
												}}
												disabled={loading}
												placeholder="Minutes ahead of UTC (e.g. -360)"
											/>
											<button className="btn small ghost-cd" type="button" onClick={useDeviceUtcOffset} disabled={loading}>
												Use device UTC
											</button>
										</div>
										<div className="muted" style={{ marginTop: 6 }}>
											{draft.utc_offset_minutes === null || draft.utc_offset_minutes === undefined ? '' : `Detected: ${formatUtcOffset(draft.utc_offset_minutes)}`}
										</div>

							<label>Language</label>
							<select value={draft.language} onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))} disabled={loading}>
								<option value="English (EN)">English (EN)</option>
								<option value="Spanish (ES)">Spanish (ES)</option>
							</select>

							<label>Location</label>
							<div className="location-row">
								<input value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} disabled={loading} />
								<button className="btn small ghost-cd" type="button" onClick={useCurrentGps} disabled={loading}>
									Use GPS
								</button>
							</div>
							<div className="muted" style={{ marginTop: 6 }}>
								{(draft.gps_lat != null && draft.gps_lng != null) ? `GPS: ${Number(draft.gps_lat).toFixed(5)}, ${Number(draft.gps_lng).toFixed(5)}` : ''}
							</div>
						</div>
					</div>
				</div>

				<div className="card prefs-card">
					<div className="card-header"><h3>Account & Preferences</h3></div>
					<div className="prefs-body">

						<div className="pref-section" style={{marginBottom: "20px"}}>
							<h4>Quick Actions</h4>
							<button className="btn small ghost-cd" type="button" onClick={pickAvatarFile} disabled={uploadingAvatar}>Change Profile Photo</button>
						</div>

						<div className="pref-section">
							<h4>Privacy Settings</h4>
								{/** Preference toggles made interactive with local state */}
								<PrefToggles
									showEmail={draft.show_email_internal_only}
									setShowEmail={(v) => setDraft((d) => ({ ...d, show_email_internal_only: v }))}
									twoFactor={draft.mfa_enabled}
									setTwoFactor={(v) => setDraft((d) => ({ ...d, mfa_enabled: v }))}
									autoSignIn={draft.trusted_devices_enabled}
									setAutoSignIn={(v) => setDraft((d) => ({ ...d, trusted_devices_enabled: v }))}
								/>
						</div>
					</div>
				</div>
			</div>

			<div className="card login-activity">
				<div className="card-header">
					<h3>Login Activity</h3>
					<div className="actions">
						<button
							className="btn small-cd"
							style={{ background: 'red' }}
							type="button"
							onClick={signOutOtherDevices}
							disabled={loadingSessions}
						>
							{loadingSessions ? 'Loading…' : 'Sign Out Other Devices'}
						</button>
					</div>
				</div>

				<div className="login-table">
					<table>
						<thead>
							<tr>
								<th>Device</th>
								<th>Location</th>
								<th>Last Access</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{(sessions || []).length === 0 ? (
								<tr>
									<td colSpan={4} className="muted" style={{ padding: 14 }}>
										{loadingSessions ? 'Loading…' : 'No recent sessions yet.'}
									</td>
								</tr>
							) : (
								sessions.map((s) => {
									const id = s?.id || s?.session_id || '';
									const current = getSessionId();
									const isCurrent = !!(id && current && id === current);
									const revokedAt = s?.revoked_at;
									const statusLabel = revokedAt ? 'Signed Out' : (isCurrent ? 'Current' : 'Active');
									const badgeClass = revokedAt ? 'revoked' : 'active';
									const ua = String(s?.user_agent || s?.last_user_agent || '').trim();
									const device = ua ? ua.slice(0, 60) : (s?.trusted_device_id ? `Trusted device ${s.trusted_device_id}` : 'Browser');
									const loc = s?.ip || s?.last_ip || '—';
									const last = formatWhen(s?.last_seen_at || s?.created_at);
									return (
										<tr key={id || `${device}-${last}`}> 
											<td>{device}{isCurrent ? ' (this device)' : ''}</td>
											<td>{loc}</td>
											<td>{last}</td>
											<td><span className={`int-status-badge ${badgeClass}`}>{statusLabel}</span></td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
            <div style={{justifyContent: "flex-end", display:'flex', gap: '10px', marginTop: '20px'}}>
				<button className="btn small-cd" type="button" onClick={onSave} disabled={loading || saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
				<button className="btn small ghost-cd" type="button" onClick={onCancel} disabled={loading || saving}>Cancel</button>
            </div>
		</div>
	);
}

function PrefToggles({ showEmail, setShowEmail, twoFactor, setTwoFactor, autoSignIn, setAutoSignIn }){

	return (
		<>
			<div className="pref-row">
				<div className="pref-left">
					<span>Show email to internal team only</span>
					<div className="muted">Your email will be visible to team members</div>
				</div>
				<button
					aria-pressed={showEmail}
					onClick={() => setShowEmail(!showEmail)}
					className={`pref-toggle ${showEmail ? 'on' : ''}`}
				/>
			</div>

			<div className="pref-row">
				<div className="pref-left">
					<span>Enable two-factor login via email</span>
					<div className="muted">Extra security for your account</div>
				</div>
				<button
					aria-pressed={twoFactor}
					onClick={() => setTwoFactor(!twoFactor)}
					className={`pref-toggle ${twoFactor ? 'on' : ''}`}
				/>
			</div>

			<div className="pref-row">
				<div className="pref-left">
					<span>Enable auto-sign-in from trusted devices</span>
					<div className="muted">Stay logged in on recognized devices</div>
				</div>
				<button
					aria-pressed={autoSignIn}
					onClick={() => setAutoSignIn(!autoSignIn)}
					className={`pref-toggle ${autoSignIn ? 'on' : ''}`}
				/>
			</div>
		</>
	)
}

