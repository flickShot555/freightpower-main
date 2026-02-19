import '../../styles/landing_page/FinalCTA.css';
import ctaBg from '../../assets/cta_bg.jpg';
import arrowRight from '../../assets/arrow right.svg';

export default function FinalCTA() {
  return (
    <section className="final-cta-section" style={{backgroundImage: `url(${ctaBg})`}}>
      {/* Dark overlay for better text readability */}
      <div className="final-cta-overlay"></div>
      
      <div className="final-cta-container">
        <div className="final-cta-content">
          <h1 className="final-cta-title">
            Ready to Move Freight<br />
            with AI-Powered<br />
            Simplicity?
          </h1>
          
          <p className="final-cta-description">
            Streamline your operations, connect with the right partners, and 
            manage freight effortlessly using our all-in-one, AI-driven platform
          </p>
          
          <div className="final-cta-buttons">
            <button className="final-cta-button final-cta-button-primary">
              Contact us
              <div className="final-cta-button-icon">
                <img src={arrowRight} alt="arrow" />
              </div>
            </button>
            
            <button className="final-cta-button final-cta-button-secondary">
              Get Started
              <div className="final-cta-button-icon">
                <img src={arrowRight} alt="arrow" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}