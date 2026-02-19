import { useState, useEffect } from 'react';
import supportIcon from '../../assets/support.svg';
import searchIcon from '../../assets/search.svg';
import chatIcon from '../../assets/chat.svg';
import ticketIcon from '../../assets/ticket.svg';
import contactIcon from '../../assets/contact.svg';
import faqIcon from '../../assets/faq.svg';
import videoIcon from '../../assets/video.svg';
import docIcon from '../../assets/doc.svg';
import contactBlueIcon from '../../assets/contact_blue.svg';
import mailIcon from '../../assets/mail.svg';
import botIcon from '../../assets/bot.svg';
import '../../styles/landing_page/HelpCenter.css';

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    // Handle search functionality
    console.log('Searching for:', searchQuery);
  };

  return (
    <div className="help-center-page">
      
      {/* Top Header Bar */}
      <div className="help-center-top-bar">
        <div className="help-center-top-container">
          <div className="support-center-brand">
            <button 
              className="support-center-icon-button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Scroll to top"
            >
              <div className="support-center-icon">
                <img src={supportIcon} alt="Support" width="15" height="15" />
              </div>
              <span className="support-center-title">Support Center</span>
            </button>
          </div>
          
          <div className="help-center-user-section">
            <div className="help-center-notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="#6b7280"/>
              </svg>
            </div>
            
            <div className="help-center-user-avatar">
              <div className="user-avatar-circle">
                <span>L</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="help-center-container">
        {/* Header Section */}
        <div className="help-center-header">
          <h1 className="help-center-title">How can we help you?</h1>
          <p className="help-center-subtitle">
            Get the support you need with our comprehensive help resources
          </p>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="help-search-form">
            <div className="help-search-container">
              <div className="search-icon">
                <img src={searchIcon} alt="Search" width="20" height="20" />
              </div>
              <input
                type="text"
                placeholder="Search for help articles, guides, or FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="help-search-input"
              />
            </div>
          </form>
        </div>

        {/* Support Options */}
        <div className="support-options">
          <div className="support-option">
            <div className="support-option-icon chat">
              <img src={chatIcon} alt="Chat" width="24" height="24" />
            </div>
            <h3 className="support-option-title">Chat with Support</h3>
            <p className="support-option-description">
              Get instant help from our support team
            </p>
            <button className="support-option-button primary">Start Chat</button>
          </div>

          <div className="support-option">
            <div className="support-option-icon ticket">
              <img src={ticketIcon} alt="Ticket" width="24" height="24" />
            </div>
            <h3 className="support-option-title">Submit a Ticket</h3>
            <p className="support-option-description">
              Create a support ticket for detailed assistance
            </p>
            <button className="support-option-button secondary">Create Ticket</button>
          </div>

          <div className="support-option">
            <div className="support-option-icon phone">
              <img src={contactIcon} alt="Emergency Contact" width="24" height="24" />
            </div>
            <h3 className="support-option-title">Emergency Support</h3>
            <p className="support-option-description">
              24/7 emergency support line
            </p>
            <button className="support-option-button tertiary">Call Now</button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="help-content-grid">
          {/* Left Column */}
          <div className="help-left-column">
            {/* Help Center and Popular Articles Combined Section */}
            <div className="help-center-combined-section">
              {/* Help Center */}
              <div className="help-center-content">
                <h2 className="help-center-section-title">Help Center</h2>
                
                <div className="help-center-cards">
                  <div className="help-center-card">
                    <div className="help-center-card-icon faq-icon">
                      <img src={faqIcon} alt="FAQ" width="24" height="24" />
                    </div>
                    <div className="help-center-card-content">
                      <h3 className="help-center-card-title">Frequently Asked Questions</h3>
                      <p className="help-center-card-description">Find quick answers to common questions</p>
                    </div>
                  </div>

                  <div className="help-center-card">
                    <div className="help-center-card-icon video-icon">
                      <img src={videoIcon} alt="Video" width="24" height="24" />
                    </div>
                    <div className="help-center-card-content">
                      <h3 className="help-center-card-title">Video Tutorials</h3>
                      <p className="help-center-card-description">Step-by-step video guides</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Popular Articles */}
              <div className="popular-articles-content">
                <h2 className="popular-articles-title">Popular Articles</h2>
                
                <div className="popular-articles-list">
                  <div className="popular-article-item">
                    <div className="article-icon">
                      <img src={docIcon} alt="Document" width="16" height="16" />
                    </div>
                    <span className="article-title">How to reset your password</span>
                    <div className="article-arrow">›</div>
                  </div>

                  <div className="popular-article-item">
                    <div className="article-icon">
                      <img src={docIcon} alt="Document" width="16" height="16" />
                    </div>
                    <span className="article-title">Getting started guide</span>
                    <div className="article-arrow">›</div>
                  </div>

                  <div className="popular-article-item">
                    <div className="article-icon">
                      <img src={docIcon} alt="Document" width="16" height="16" />
                    </div>
                    <span className="article-title">Account settings and preferences</span>
                    <div className="article-arrow">›</div>
                  </div>

                  <div className="popular-article-item">
                    <div className="article-icon">
                      <img src={docIcon} alt="Document" width="16" height="16" />
                    </div>
                    <span className="article-title">Billing and subscription management</span>
                    <div className="article-arrow">›</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="help-right-column">
            {/* Contact Information */}
            <div className="contact-info-card">
              <h3 className="contact-info-title">Contact Information</h3>
              
              <div className="contact-info-item">
                <div className="contact-info-icon">
                  <img src={contactBlueIcon} alt="Phone" width="16" height="16" />
                </div>
                <div className="contact-info-details">
                  <div className="contact-info-label">Phone Support</div>
                  <div className="contact-info-value">+1 (555) 123-4567</div>
                </div>
              </div>

              <div className="contact-info-item">
                <div className="contact-info-icon">
                  <img src={mailIcon} alt="Email" width="16" height="16" />
                </div>
                <div className="contact-info-details">
                  <div className="contact-info-label">Email Support</div>
                  <div className="contact-info-value">support@company.com</div>
                </div>
              </div>
            </div>

            {/* Support Hours */}
            <div className="support-hours-card">
              <h3 className="support-hours-title">Support Hours</h3>
              
              <div className="support-hours-list">
                <div className="support-hours-item">
                  <span className="support-day">Monday - Friday</span>
                  <span className="support-time">9:00 AM - 6:00 PM</span>
                </div>
                <div className="support-hours-item">
                  <span className="support-day">Saturday</span>
                  <span className="support-time">10:00 AM - 4:00 PM</span>
                </div>
                <div className="support-hours-item">
                  <span className="support-day">Sunday</span>
                  <span className="support-time">Closed</span>
                </div>
              </div>

              {/* Emergency Support */}
              <div className="emergency-support-notice">
                <div className="emergency-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.00463 2.39886C7.39066 1.74038 8.26866 1.74038 8.65469 2.39886L14.6547 12.7989C15.0407 13.4574 14.5721 14.2989 13.7993 14.2989H1.79931C1.02653 14.2989 0.557906 13.4574 0.943938 12.7989L7.00463 2.39886Z" fill="#DC2626"/>
                    <path d="M8 6V9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="11.5" r="0.75" fill="white"/>
                  </svg>
                </div>
                <div className="emergency-content">
                  <div className="emergency-title">Emergency Support</div>
                  <div className="emergency-description">24/7 emergency line available for critical issues</div>
                  <div className="emergency-phone">+1 (555) 911-HELP</div>
                </div>
              </div>
            </div>

            {/* Need Immediate Help */}
            <div className="immediate-help-card">
              <h3 className="immediate-help-card-title">Need Immediate Help?</h3>
              <p className="immediate-help-card-description">
                Our AI assistant is available 24/7 to help with common questions
              </p>
              <button className="immediate-help-card-button">
                <img src={botIcon} alt="AI Bot" width="16" height="16" />
                Chat with AI Assistant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}