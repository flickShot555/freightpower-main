import React, { useState } from 'react';
import '../../styles/carrier/Analytics.css';

const Analytics = () => {
  const [activeTab, setActiveTab] = useState('Operations Dashboard');
  const [timeRange, setTimeRange] = useState('Last 30 Days');

  // Mock analytics data
  const analyticsData = {
    loadsDelivered: { value: 247, icon: 'fa-solid fa-truck' },
    accepted: { value: 231, icon: 'fa-solid fa-check' },
    delivered: { value: 218, icon: 'fa-solid fa-box' },
    onTimePercent: { value: '94.3%', icon: 'fa-solid fa-circle-dot' },
    avgRpm: { value: '$2.47', icon: 'fa-solid fa-dollar-sign' },
    avgRpu: { value: '$847', icon: 'fa-solid fa-calendar' }
  };

  const tabs = [
    'Operations Dashboard',
    'Finance Dashboard', 
    'Compliance Dashboard',
    'Custom Reports',
    'Reports Archive'
  ];

  const timeRanges = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year', 'Custom Range'];

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-content">
          <h1>Analytics & Reports</h1>
          <p className="header-subtitle">Track operational performance, financial health, and compliance trends</p>
        </div>
        <div className="header-actions">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select" style={{borderRadius: "100px"}}
          >
            {timeRanges.map(range => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>
          <button className="btn small ghost-cd">
            <i className="fa-solid fa-download"></i>
            Export All
          </button>
        </div>
      </div>

      {/* Dashboard Content Only (Tabs Removed) */}
      <div className="dashboard-content">
        {/* Statistics Cards */}
        <div className="cd-analytics-stats-grid">
          <div className="cd-analytics-stat-card">
            <div className="cd-analytics-stat-icon">
              <i className={analyticsData.loadsDelivered.icon}></i>
            </div>
            <div className="cd-analytics-stat-info">
              <div className="cd-analytics-stat-value">{analyticsData.loadsDelivered.value}</div>
              <div className="cd-analytics-stat-label">Loads Tendered</div>
            </div>
          </div>

          <div className="cd-analytics-stat-card">
            <div className="cd-analytics-stat-icon">
              <i className={analyticsData.accepted.icon}></i>
            </div>
            <div className="cd-analytics-stat-info">
              <div className="cd-analytics-stat-value">{analyticsData.accepted.value}</div>
              <div className="cd-analytics-stat-label">Accepted</div>
            </div>
          </div>

          <div className="cd-analytics-stat-card">
            <div className="cd-analytics-stat-icon">
              <i className={analyticsData.delivered.icon}></i>
            </div>
            <div className="cd-analytics-stat-info">
              <div className="cd-analytics-stat-value">{analyticsData.delivered.value}</div>
              <div className="cd-analytics-stat-label">Delivered</div>
            </div>
          </div>

          <div className="cd-analytics-stat-card">
            <div className="cd-analytics-stat-icon">
              <i className={analyticsData.onTimePercent.icon}></i>
            </div>
            <div className="cd-analytics-stat-info">
              <div className="cd-analytics-stat-value">{analyticsData.onTimePercent.value}</div>
              <div className="cd-analytics-stat-label">On-Time %</div>
            </div>
          </div>

          <div className="cd-analytics-stat-card">
            <div className="cd-analytics-stat-icon">
              <i className={analyticsData.avgRpm.icon}></i>
            </div>
            <div className="cd-analytics-stat-info">
              <div className="cd-analytics-stat-value">{analyticsData.avgRpm.value}</div>
              <div className="cd-analytics-stat-label">Avg. RPM</div>
            </div>
          </div>

          <div className="cd-analytics-stat-card">
            <div className="cd-analytics-stat-icon">
              <i className={analyticsData.avgRpu.icon}></i>
            </div>
            <div className="cd-analytics-stat-info">
              <div className="cd-analytics-stat-value">{analyticsData.avgRpu.value}</div>
              <div className="cd-analytics-stat-label">Avg. RPU</div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          <div className="chart-card">
            <div className="chart-header">
              <h3>On-Time Performance</h3>
              <button className="export-chart-btn">Export</button>
            </div>
            <div className="chart-placeholder">
              <div className="chart-icon">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <p>Performance chart will be displayed here</p>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3>Loads by Region</h3>
              <button className="export-chart-btn">Export</button>
            </div>
            <div className="chart-placeholder">
              <div className="chart-icon">
                <i className="fa-solid fa-map"></i>
              </div>
              <p>Regional distribution chart will be displayed here</p>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3>Load Distribution</h3>
              <button className="export-chart-btn">Export</button>
            </div>
            <div className="chart-placeholder">
              <div className="chart-icon">
                <i className="fa-solid fa-chart-pie"></i>
              </div>
              <p>Distribution chart will be displayed here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;