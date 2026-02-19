import React from 'react';
import '../../styles/shipper/TrackingVisibility.css';
import HereMap from '../common/HereMap';

export default function TrackingVisibility() {
  return (
    <div className="tracking-root">
        <header className="fp-header">
          <div className='sd-carrier-row'>
            <div className="fp-header-titles">
              <h2>Tracking/Visibility</h2>
            </div>
          </div>
        </header>
      <header className="sh-tracking-header">
        <div className="sh-tracking-controls">
          <select className="filter"> <option>Last 7 Days</option> </select>
          <select className="filter"> <option>All Status</option> </select>
          <select className="filter"> <option>All Modes</option> </select>
          <div className="shh-search-box">
            <input placeholder="Search Load #, PO..." />
          </div>
        </div>

        {/* Status badges row (unique classes prefixed with tv-) */}
        <div className="tv-badges-row">
          <div className="int-status-badge active tv-active"><span className="tv-dot"/> Active Loads (24)</div>
          <div className="int-status-badge pending tv-risk"><span className="tv-dot"/> At Risk (3)</div>
          <div className="int-status-badge revoked tv-exc"><span className="tv-dot"/> Exceptions (2)</div>
          <div className="int-status-badge pending tv-risk"><span className="tv-dot"/> ETA &lt; 4h (8)</div>
          <div className="int-status-badge active tv-active"><span className="tv-dot"/> Delivered Today (12)</div>
        </div>
      </header>

      <div className="tracking-alerts">
        <div className="tv-alert tv-alert-red"><i className="tv-alert-icon fa-solid fa-triangle-exclamation" aria-hidden></i><span>3 Late Loads</span></div>
        <div className="tv-alert tv-alert-yellow"><i className="tv-alert-icon fa-solid fa-location-dot" aria-hidden></i><span>2 No Ping &gt; 90min</span></div>
        <div className="tv-alert tv-alert-pink"><i className="tv-alert-icon fa-solid fa-car-crash" aria-hidden></i><span>1 Incident Reported</span></div>
      </div>

      <div className="tracking-main">
        <div className="map-card">
          <HereMap
            containerId="shipper-tracking-map"
            center={{ lat: 39.8283, lng: -98.5795 }}
            zoom={4}
            height="500px"
            width="100%"
          />
        </div>

        <div className="right-panel">
          <div className="load-card">
            <div className="load-header">
              <div className="load-header-left">
                <div className="load-id">Load #FP-2024-1321</div>
                <div className="load-route">Chicago, IL → Atlanta, GA</div>
              </div>
              <div className="load-header-right">
                <div className="int-status-badge pending" style={{display: "inline-block"}}>In Transit</div>
                <div className="load-eta">ETA: <strong>2:40 PM</strong> <span className="load-late">(40 min late)</span></div>
              </div>
            </div>
            <div className="load-meta-container-align">
                    <div className="load-meta">Carrier: <strong>Swift Transportation</strong></div>
                <div className="load-meta">Driver: <strong>John Martinez</strong></div>
                </div>

            <div className="load-body">
              <div className="ai-insight-card">
                <div className="tr-ai-icon"><i className="fa-regular fa-lightbulb"/></div>
                <div className="ai-text"><strong>AI Insight:</strong> Load 1321 running 40 min late due to heavy traffic near Madison. Suggest notifying consignee.</div>
              </div>

              <div className="timeline">
                <div className="tl-item completed">
                  <div className="tl-left"><div className="tl-icon">✓</div></div>
                  <div className="tl-right">
                    <div className="tl-title">Pickup Completed</div>
                    <div className="tl-sub">Chicago Distribution Center</div>
                  </div>
                  <div className="tl-time">Yesterday 3:45 PM</div>
                </div>

                <div className="tl-item current">
                  <div className="tl-left"><div className="tl-icon"><i className="fa-solid fa-truck-moving"></i></div></div>
                  <div className="tl-right">
                    <div className="tl-title">In Transit</div>
                    <div className="tl-sub">287 miles remaining · 65 mph avg speed</div>
                    <div className="progress-wrap"><div className="progress-bar"><div className="progress-fill" style={{ width: '40%' }}></div></div></div>
                  </div>
                  <div className="tl-time">Current</div>
                </div>

                <div className="tl-item upcoming">
                  <div className="tl-left"><div className="tl-icon"><i className="fa-solid fa-box"></i></div></div>
                  <div className="tl-right">
                    <div className="tl-title">Delivery Scheduled</div>
                    <div className="tl-sub">Atlanta Warehouse District</div>
                  </div>
                  <div className="tl-time">Today 2:40 PM</div>
                </div>
              </div>

              <div className="load-actions-col">
                <button className="btn small-cd"><i className="fa-solid fa-phone" style={{marginRight: '20px'}}/>  Call Driver</button>
                <button className="btn small ghost-cd"><i className="fa-solid fa-comment" style={{marginRight: '20px'}}/> Send Message</button>
                  <button className="btn small ghost-cd"><i className="fa-solid fa-share-nodes" style={{marginRight: '20px'}}/> Share Tracking</button>
                  <button className="btn small ghost-cd"><i className="fa-solid fa-flag" style={{marginRight: '20px'}}/> Report Issue</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="load-table-card">
            <h4>Load Overview</h4>
            <table className="load-table">
              <thead>
                <tr><th>Load #</th><th>Carrier</th><th>Driver</th><th>Status</th><th>ETA</th><th>Actions</th></tr>
              </thead>
              <tbody>
                <tr><td>FP-1321</td><td>Swift Transportation</td><td>John Martinez</td><td>In Transit</td><td>2:40 PM</td><td><i className="fa-solid fa-ellipsis-h"></i></td></tr>
                <tr><td>FP-1322</td><td>JB Hunt</td><td>Sarah Wilson</td><td>On Time</td><td>4:15 PM</td><td><i className="fa-solid fa-ellipsis-h"></i></td></tr>
                <tr><td>FP-1323</td><td>Werner Enterprises</td><td>Mike Johnson</td><td>Exception</td><td>Delayed</td><td><i className="fa-solid fa-ellipsis-h"></i></td></tr>
              </tbody>
            </table>
          </div>
    </div>
  );
}
