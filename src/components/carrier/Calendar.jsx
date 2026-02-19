import React, { useState } from 'react';
import '../../styles/carrier/Calendar.css';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 9, 4)); // October 4, 2025 (month is 0-indexed)
  const [viewMode, setViewMode] = useState('Month');

  // Events data matching the screenshot for October 2025
  const events = [
    // October 2, 2025
    { id: 1, date: '2025-10-02', title: 'Load #4521', subtitle: 'Pickup: 9:00 AM', type: 'loads', color: '#4285f4' },
    
    // October 3, 2025
    { id: 2, date: '2025-10-03', title: 'CDL Renewal', subtitle: 'Driver: John D.', type: 'compliance', color: '#ea4335' },
    
    // October 5, 2025
    { id: 3, date: '2025-10-05', title: 'Invoice Due', subtitle: '$2,450.00', type: 'finance', color: '#00bcd4' },
    { id: 4, date: '2025-10-05', title: 'Load #4532', subtitle: 'Delivery: 2:00 PM', type: 'loads', color: '#4285f4' },
    
    // October 9, 2025
    { id: 5, date: '2025-10-09', title: 'Team Meeting', subtitle: '10:00 AM', type: 'internal', color: '#9e9e9e' },
    
    // October 10, 2025
    { id: 6, date: '2025-10-10', title: 'Load #4523', subtitle: 'Pickup: 7:00 AM', type: 'loads', color: '#4285f4' },
    
    // October 12, 2025
    { id: 7, date: '2025-10-12', title: 'DOT Inspection', subtitle: 'Unit #9305', type: 'compliance', color: '#ea4335' },
    
    // October 16, 2025
    { id: 8, date: '2025-10-16', title: 'Factoring Payment', subtitle: '$5,200.00', type: 'finance', color: '#00bcd4' },
    
    // October 17, 2025
    { id: 9, date: '2025-10-17', title: 'Load #4524', subtitle: 'Multi-drop', type: 'loads', color: '#4285f4' },
    
    // October 18, 2025
    { id: 10, date: '2025-10-18', title: 'Load #4525', subtitle: 'Pickup: 8:00 AM', type: 'loads', color: '#4285f4' },
    { id: 11, date: '2025-10-18', title: 'Driver Review', subtitle: 'Mike T.', type: 'internal', color: '#9e9e9e' },
    
    // October 20, 2025
    { id: 12, date: '2025-10-20', title: 'Insurance Renewal', subtitle: 'Due Today', type: 'compliance', color: '#ea4335' },
    
    // October 23, 2025
    { id: 13, date: '2025-10-23', title: 'Load #4526', subtitle: 'Express', type: 'loads', color: '#4285f4' },
    
    // October 30, 2025
    { id: 14, date: '2025-10-30', title: 'Month End', subtitle: 'Reports Due', type: 'finance', color: '#00bcd4' }
  ];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => event.date === dateString);
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const days = getDaysInMonth(currentDate);

  // Statistics calculations
  const thisMonthEvents = events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getMonth() === currentDate.getMonth() && eventDate.getFullYear() === currentDate.getFullYear();
  });

  // Statistics matching the screenshot
  const activeLoads = 28; // "This Month" active loads
  const complianceItems = 5; // "Upcoming" compliance items
  const thisWeekRevenue = '$12.4K'; // "This Week" revenue

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-title-section">
          <h1>Calendar</h1>
        </div>
        <div className="calendar-actions">
          <button className="btn small ghost-cd">
            <i className="fa-solid fa-arrows-rotate"></i>
            Sync External
          </button>
          <button className="btn small-cd">
            <i className="fa-solid fa-plus"></i>
            Add Event
          </button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="calendar-nav">
        <div className="month-nav">
          <button className="nav-btn" onClick={() => navigateMonth(-1)}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <h2 className="current-month">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button className="nav-btn" onClick={() => navigateMonth(1)}>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        <button className="btn small ghost-cd" onClick={goToToday}>Today</button>
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-dot loads"></div>
          <span>Loads</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot compliance"></div>
          <span>Compliance</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot finance"></div>
          <span>Finance</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot internal"></div>
          <span>Internal</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day headers */}
        <div className="calendar-header-row">
          {dayNames.map(day => (
            <div key={day} className="day-header">{day}</div>
          ))}
        </div>
        
        {/* Calendar days */}
        <div className="calendar-body">
          {days.map((day, index) => {
            const dayEvents = getEventsForDate(day);
            return (
              <div key={index} className={`calendar-day ${!day ? 'empty' : ''}`}>
                {day && (
                  <>
                    <div className="day-number">{day}</div>
                    <div className="day-events">
                      {dayEvents.map(event => (
                        <div 
                          key={event.id} 
                          className={`event event-${event.type}`}
                        >
                          <div className="event-title">{event.title}</div>
                          <div className="event-subtitle">{event.subtitle}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Statistics */}
      <div className="calendar-stats">
        <div className="cal-stat-card">
          <div className="cal-stat-icon loads">
            <i className="fa-solid fa-truck"></i>
          </div>
          <div className="cal-stat-info">
            <div className="cal-stat-label">This Month</div>
            <div className="cal-stat-number">{activeLoads}</div>
            <div className="cal-stat-sublabel">Active Loads</div>
          </div>
        </div>

        <div className="cal-stat-card">
          <div className="cal-stat-icon compliance">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="cal-stat-info">
            <div className="cal-stat-label">Upcoming</div>
            <div className="cal-stat-number">{complianceItems}</div>
            <div className="cal-stat-sublabel">Compliance Due</div>
          </div>
        </div>

        <div className="cal-stat-card">
          <div className="cal-stat-icon revenue">
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
          <div className="cal-stat-info">
            <div className="cal-stat-label">This Week</div>
            <div className="cal-stat-number">{thisWeekRevenue}</div>
            <div className="cal-stat-sublabel">Revenue</div>
          </div>
        </div>

        <div className="cal-stat-card">
          <div className="cal-stat-icon sync">
            <i className="fa-solid fa-check"></i>
          </div>
          <div className="cal-stat-info">
            <div className="cal-stat-label">Sync Status</div>
            <div className="sync-status">Google Connected</div>
          </div>
        </div>
      </div>
    </div>
  );
}