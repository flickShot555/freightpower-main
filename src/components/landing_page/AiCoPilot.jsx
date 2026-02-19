import '../../styles/landing_page/AiCoPilot.css';
import aiMobileImage from '../../assets/ai_mobile.svg';

export default function AiCoPilot() {
  const aiFeatures = [
    {
      title: "Ask questions instantly"
    },
    {
      title: "Get AI-powered load suggestions"
    },
    {
      title: "Check compliance status in real time"
    },
    {
      title: "Supports both voice and text commands"
    }
  ];

  return (
    <section className="ai-copilot-section">
      <div className="ai-copilot-container">
        <div className="ai-copilot-grid">
          {/* Left - Mobile App Preview */}
          <div className="ai-copilot-mockup">
            <img 
              src={aiMobileImage} 
              alt="FreightPower AI Mobile Interface - Multiple phone screens showing dashboard"
              className="ai-copilot-mobile-image"
            />
          </div>

          {/* Right - Content */}
          <div className="ai-copilot-content">
            <h2 className="ai-copilot-title">
              Meet Your AI Co-Pilot
              <br />
              FreightBot
            </h2>

            <p className="ai-copilot-description">
              Your intelligent assistant for faster decisions, smarter load management, and real-time answers — all in one easy-to-use chat interface.
            </p>

            <div className="ai-copilot-features">
              {aiFeatures.map((feature, index) => (
                <div key={index} className="ai-copilot-feature">
                  <div className="ai-copilot-feature-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ai-copilot-feature-content">
                    <h3>{feature.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}