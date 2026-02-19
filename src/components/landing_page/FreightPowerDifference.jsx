import { useState } from 'react';
import content from '../../assets/content.svg';
import '../../styles/landing_page/FreightPowerDifference.css';

export default function FreightPowerDifference() {
  const [activeTab, setActiveTab] = useState('Marketplace Dashboard');

  const tabs = [
    'Marketplace Dashboard',
    'AI Automation', 
    'Document Vault',
    'Fast Onboarding',
    'GPS + Live Visibility'
  ];

  const tabContent = {
    'Marketplace Dashboard': {
      subtitle: 'Real-time hub connecting carriers, drivers, and shippers with GPS, smart matching, and AI load assignments.',
      features: [
        'Service providers list in real-time',
        'Live GPS shows trucks on map',
        'Smart match between driver, carrier, shipper',
        'AI assigns based on proximity and capacity'
      ]
    },
    'AI Automation': {
      subtitle: 'Intelligent automation that streamlines operations and optimizes freight management.',
      features: [
        'Intelligent route optimization powered by machine learning',
        'Automated load matching based on historical data',
        'Predictive maintenance alerts for fleet management',
        'Smart pricing recommendations using market analytics'
      ]
    },
    'Document Vault': {
      subtitle: 'Secure digital storage and management for all your freight documentation.',
      features: [
        'Secure cloud storage for all shipping documents',
        'Automated document generation and compliance checking',
        'Digital signature integration for faster processing',
        'Version control and audit trails for regulatory compliance'
      ]
    },
    'Fast Onboarding': {
      subtitle: 'Quick and efficient registration process for carriers, drivers, and shippers.',
      features: [
        'Streamlined carrier and driver registration process',
        'Automated background checks and verification',
        'Digital document upload and instant approval',
        'Integration with existing systems and workflows'
      ]
    },
    'GPS + Live Visibility': {
      subtitle: 'Real-time tracking and visibility for complete freight transparency.',
      features: [
        'Real-time GPS tracking with 99.9% accuracy',
        'Live updates on delivery status and location',
        'Geofencing alerts for pickup and delivery zones',
        'Historical route analysis and optimization insights'
      ]
    }
  };

  return (
    <section id="about" className="freight-difference-section">
      <div className="freight-difference-container">
        <div className="freight-difference-header">
          <h2 className="freight-difference-title">
            FreightPower Difference
          </h2>
          
          {/* Tab Navigation */}
          <div className="freight-difference-tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`freight-difference-tab ${activeTab === tab ? 'freight-difference-tab-active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="freight-difference-grid">
          {/* Left Content */}
          <div>
            <h3 className="freight-difference-content-title">
              {activeTab}
            </h3>
            <p className="freight-difference-content-subtitle">
              {tabContent[activeTab].subtitle}
            </p>
            <div className="freight-difference-features">
              {tabContent[activeTab].features.map((feature, index) => (
                <div key={index} className="freight-difference-feature">
                  <div className="freight-difference-feature-dot"></div>
                  <p className="freight-difference-feature-text">{feature}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Dashboard Preview */}
          <div className="freight-difference-dashboard">
            <img
              src={content} 
              alt="Dashboard Preview"
              className="freight-difference-dashboard-image"
            />
          </div>
        </div>
      </div>
    </section>
  )
}