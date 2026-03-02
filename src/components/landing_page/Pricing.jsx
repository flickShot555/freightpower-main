import React from 'react';
import '../../styles/landing_page/Pricing.css';

export default function Pricing() {
  const plans = [
    {
      name: "Free Plan",
      subtitle: "For Drivers",
      price: "$0",
      period: "month",
      features: [
        "Basic trip tracking",
        "Document upload",
        "Access to job postings",
        "Live GPS view",
        "Mobile app access"
      ],
      popular: false,
      cta: "Get Started Now"
    },
    {
      name: "Starter Plan", 
      subtitle: "For Small Carriers",
      price: "$40",
      period: "month",
      features: [
        "Everything in Free Plan",
        "Load management tools",
        "Drive tracking",
        "Marketplace access",
        "Mobile app access"
      ],
      popular: false,
      cta: "Get Started Now"
    },
    {
      name: "Premium Plan",
      subtitle: "For Shippers/Brokers",
      price: "$80",
      period: "month", 
      features: [
        "Advanced AI",
        "Priority placement",
        "Access to job postings",
        "Fleet performance",
        "Account Support"
      ],
      popular: false,
      cta: "Get Started Now"
    }
  ];

  return (
    <section id="pricing" className="pricing-section">
      <div className="pricing-container">
        <div className="pricing-header">
          <h2 className="pricing-title">
            Choose the Right Plan for
            <br />
            Your Fleet or Business
          </h2>
          <p className="pricing-subtitle">
            Flexible pricing options designed to scale with your business needs, 
            from startups to enterprise logistics operations.
          </p>
        </div>

        <div className="blue-container">
          <div className='white-container'>
            <div className="pricing-grid">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`pricing-card ${
                plan.popular 
                  ? 'pricing-card-popular' 
                  : 'pricing-card-standard'
              }`}
            >
              {plan.popular && (
                <div className="pricing-popular-badge">
                  Most Popular
                </div>
              )}

              <div className="pricing-card-header">
                <h3 className="pricing-card-name">{plan.name}</h3>
                <p className="pricing-card-subtitle">{plan.subtitle}</p>
                <div className="pricing-card-price-container">
                  <span className="pricing-card-price">{plan.price}</span>
                  <span className={`pricing-card-period ${
                    plan.popular ? 'pricing-card-period-popular' : 'pricing-card-period-standard'
                  }`}>
                    /{plan.period}
                  </span>
                </div>
                <button 
                  className={`pricing-cta-button ${
                    plan.popular
                      ? 'pricing-cta-button-popular'
                      : 'pricing-cta-button-standard'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>

              <div className="pricing-features-title">What's Included</div>
              <ul className="pricing-features">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="pricing-feature">
                    <svg 
                      className={`pricing-feature-icon ${
                        plan.popular ? 'pricing-feature-icon-popular' : 'pricing-feature-icon-standard'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`pricing-feature-text ${
                      plan.popular ? 'pricing-feature-text-popular' : 'pricing-feature-text-standard'
                    }`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
          </div>
        </div>
      </div>
    </section>
  )
}