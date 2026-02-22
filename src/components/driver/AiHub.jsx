import React from 'react';
import '../../styles/driver/AiHub.css';
import micSvg from '../../assets/ai_mobile.svg';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { t } from '../../i18n/translate';

export default function AiHub() {
  const { settings } = useUserSettings();
  const language = settings?.language || 'English';
  const tr = (key, fallback) => t(language, key, fallback);
  const demoLoadId = tr('aiHub.demo.loadId', 'FP-2024-1205');

  return (
    <div className="aihub-root">
      <div className="aihub-container">
        <main className="aihub-chat-area">
          <div className="aihub-chat-header">
            <div className="aihub-title">{tr('aiHub.title', 'AI Co-Pilot')}</div>
            <div className="aihub-sub">{tr('aiHub.subtitle', 'Your intelligent driving assistant')}</div>
          </div>

          <div className="aihub-messages">
            <div className="aihub-message bot">
              <div className="aihub-bubble">{tr('aiHub.demo.botHello', "Hello Marcus! I'm your AI co-pilot. How can I assist you today?")}</div>
            </div>

            <div className="aihub-message user">
              <div className="aihub-bubble user-bubble">{tr('aiHub.demo.userHos', "What's my current HOS status?")}</div>
            </div>

            <div className="aihub-message bot">
              <div className="aihub-bubble">{tr('aiHub.demo.botHosAnswer', "You have 8 hours and 15 minutes remaining on your drive time. You'll need a 10-hour break by 6:30 PM today.")}</div>
            </div>
          </div>

          <div className="aihub-input-row">
            <input className="aihub-input" placeholder={tr('aiHub.inputPlaceholder', 'Ask me anything about compliance, routes, or trucking...')} />
            <button className="aihub-send-btn">{tr('aiHub.sendButton', '↩')}</button>
          </div>
        </main>

        <aside className="aihub-right-rail">
          <div className="rail-card active-trip">
            <div className="rail-card-header">{tr('aiHub.activeTrip', 'Active Trip')}</div>
            <div className="trip-info">
              <div className="trip-info-box">
                <div className="trip-info-top">
                  <div className="trip-id">{tr('aiHub.loadLabel', 'Load')} <strong>#{demoLoadId}</strong></div>
                  <div className="int-status-badge active">{tr('aiHub.inTransit', 'In Transit')}</div>
                </div>
                <div className="trip-route">{tr('aiHub.demo.route', 'Chicago, IL → Dallas, TX')}</div>
                <div className="trip-meta">{tr('aiHub.etaLabel', 'ETA:')} {tr('aiHub.demo.etaSample', 'Dec 6, 2:30 PM')}</div>
              </div>

              <div className="trip-stats">
                <div className="trip-stat">
                  <i className="fa-solid fa-clock"></i>
                  <span className="stat-text">{tr('aiHub.breakNeeded', 'Break needed in 45 mins')}</span>
                </div>
                <div className="trip-stat">
                  <i className="fa-solid fa-gas-pump"></i>
                  <span className="stat-text">{tr('aiHub.fuelSample', 'Fuel: 78% (520 miles)')}</span>
                </div>
                <div className="trip-stat">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span className="stat-text">{tr('aiHub.trafficDelay', 'Traffic delay: +15 mins')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rail-card smart-alerts">
            <div className="rail-card-header">{tr('aiHub.smartAlerts', 'Smart Alerts')}</div>
            <div className="smart-alert alert-warning">
              <div className="alert-left">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <div className="alert-texts">
                  <div className="alert-title">{tr('aiHub.alert.cdlExpiringTitle', 'CDL Expiring Soon')}</div>
                  <div className="alert-sub">{tr('aiHub.alert.cdlExpiringSub', 'Expires in 28 days - renew now')}</div>
                </div>
              </div>
            </div>

            <div className="smart-alert alert-info">
              <div className="alert-left">
                <i className='fa-solid fa-camera'></i>
                <div className="alert-texts">
                  <div className="alert-title">{tr('aiHub.alert.docQualityTitle', 'Document Quality')}</div>
                  <div className="alert-sub">{tr('aiHub.alert.docQualitySub', 'Medical card image is blurry')}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rail-card quick-actions">
            <div className="rail-card-header">{tr('dashboard.quickActions', 'Quick Actions')}</div>
            <div className="qa-grid">
              <button className="qa qa-blue">
                <i className='fa-solid fa-arrow-up'></i>
                <span className="qa-label">{tr('aiHub.qa.uploadDoc', 'Upload Doc')}</span>
              </button>
              <button className="qa qa-green">
                <i className='fa-solid fa-truck'></i>
                <span className="qa-label">{tr('aiHub.qa.activeLoad', 'Active Load')}</span>
              </button>
              <button className="qa qa-purple">
                <i className='fa-solid fa-location-crosshairs'></i>
                <span className="qa-label">{tr('aiHub.qa.nearby', 'Nearby')}</span>
              </button>
              <button className="qa qa-peach">
                <i className='fa-solid fa-headset'></i>
                <span className="qa-label">{tr('aiHub.qa.dispatcher', 'Dispatcher')}</span>
              </button>
            </div>
            <button className="btn small-cd emergency">{tr('aiHub.emergencyAssist', 'Emergency Assist')}</button>
          </div>

          <div className="rail-card insights">
            <div className="rail-card-header">{tr('aiHub.dailyInsights', 'Daily Insights')}</div>
            <div className="insight-card light-blue">
              <div className="insight-row">
                <div className="insight-icon"><i className='fa-solid fa-lightbulb'></i></div>
                <div className="insight-body">
                  <div className="insight-title">{tr('aiHub.insight.tipTitle', 'Tip of the Day')}</div>
                  <div className="insight-text">{tr('aiHub.insight.tipText', 'Check tire pressure before long hauls to improve fuel efficiency by up to 3%.')}</div>
                </div>
              </div>
            </div>

            <div className="insight-card light-green">
              <div className="insight-row">
                <div className="insight-icon"><i className='fa-solid fa-graduation-cap'></i></div>
                <div className="insight-body">
                  <div className="insight-title-grad">{tr('aiHub.insight.trainingTitle', 'Training Recap')}</div>
                  <div className="insight-text-grad">{tr('aiHub.insight.trainingText', 'Remember: 30-minute break required after 8 hours of driving.')}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
