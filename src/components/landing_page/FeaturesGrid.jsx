import '../../styles/landing_page/FeaturesGrid.css';
import aiDriverImg from '../../assets/ai_driver.svg';
import gpsImg from '../../assets/gps.svg';
import mvrImg from '../../assets/mvr.svg';
import autoDocImg from '../../assets/auto_doc.svg';

export default function FeaturesGrid() {
  const features = [
    {
      image: aiDriverImg,
      title: "AI Driver",
      description: "Quickly bring drivers and carriers onto the platform with AI-powered onboarding that verifies documents"
    },
    {
      image: gpsImg,
      title: "Live GPS & Smart ETA",
      description: "Track shipments in real time with live GPS and receive AI-calculated ETAs that adjust automatically"
    },
    {
      image: mvrImg,
      title: "FMCSA, MVR",
      description: "Keep compliance records up to date with automatic syncing of FMCSA, MVR, and drug test data"
    },
    {
      image: autoDocImg,
      title: "Automated Document",
      description: "Store and manage important documents in a secure cloud vault with automated expiry alerts and instant sharing"
    }
  ];

  return (
    <section id="features" className="features-grid-section">
      <div className="features-grid-container">
        <div className="features-grid-header">
          <h2 className="features-grid-title">
            Everything You Need to Move
            <br />
            Smarter
          </h2>
        </div>

        <div className="features-grid-main">
          {features.map((feature, index) => (
            <div key={index} className="features-grid-card">
              <div className="features-grid-image">
                <img src={feature.image} alt={feature.title} />
              </div>
              <h3 className="features-grid-card-title">
                {feature.title}
              </h3>
              <p className="features-grid-card-description">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="features-grid-cta">
          <button className="features-grid-cta-button">
            View All
          </button>
        </div>
      </div>
    </section>
  )
}