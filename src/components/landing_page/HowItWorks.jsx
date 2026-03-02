import '../../styles/landing_page/HowItWorks.css';
import chainIcon from '../../assets/chain.svg';

export default function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Sign Up & Choose Role",
      description: "Quick registration for carriers, drivers, or shippers/brokers."
    },
    {
      number: "2", 
      title: "Upload Docs or Post a Load",
      description: "Submit compliance documents or list available loads."
    },
    {
      number: "3",
      title: "AI Connects You to What You Need",
      description: "Smart matching with the right loads, drivers, or carriers."
    },
    {
      number: "4",
      title: "Track, Manage, and Move Freight",
      description: "Real-time visibility and tools to keep freight moving efficiently."
    }
  ];

  return (
    <section id="how-it-works" className="how-it-works-section">
      <div className="how-it-works-container">
        <div className="how-it-works-header">
          <h2 className="how-it-works-title">
            How FreightPower Works in 4
            <br />
            Simple Steps
          </h2>
        </div>

        <div className="how-it-works-grid">
          {steps.map((step, index) => (
            <div key={index} className="how-it-works-step">
              <div className="how-it-works-step-number">
                {step.number}
              </div>
              
              <h3 className="how-it-works-step-title">
                {step.title}
              </h3>
              <p className="how-it-works-step-description">
                {step.description}
              </p>
            </div>
          ))}
          
          
          {/* Central connecting circle with chain icon */}
          <div className="how-it-works-central-dot">
            <img src={chainIcon} alt="Chain" className="how-it-works-central-icon" />
          </div>
        </div>
      </div>
    </section>
  )
}