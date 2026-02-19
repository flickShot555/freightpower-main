import '../../styles/landing_page/IndustryRoles.css';
import roleBasedImage from '../../assets/role_based.svg';
import { Link } from 'react-router-dom';

export default function IndustryRoles() {
  return (
    <section className="industry-roles-section">
      <div className="industry-roles-container">
        <div className="industry-roles-grid">
          {/* Left - Role Based Image */}
          <div className="industry-roles-container-section">
            <img 
              src={roleBasedImage} 
              alt="Built for Every Role in the Freight Industry" 
              className="industry-roles-image"
            />
          </div>

          {/* Right - Content */}
          <div>
            <div className="industry-roles-badge">ROLE-BASED</div>
            <h2 className="industry-roles-title">
              Built for Every Role in the Freight Industry
            </h2>
            <p className="industry-roles-subtitle">
              Purpose-built tools and features designed to meet the unique needs of carriers, drivers, and shippers — helping each role work smarter.
            </p>

            <div className="industry-roles-cards">
              {/* For Carriers */}
              <Link to={{ pathname: '/signup' }} state={{ role: 'carrier' }} className="industry-roles-card industry-roles-card-blue" style={{textDecoration: 'none', cursor: 'pointer'}}>
                <div className="industry-roles-card-icon industry-roles-card-icon-white">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="industry-roles-card-title-white">For Carriers</h3>
                  <p className="industry-roles-card-description-white">Easily track and maintain regulatory compliance, efficiently manage and optimize your loads, and seamlessly hire qualified drivers.</p>
                </div>
              </Link>

              {/* For Drivers */}
              <Link to={{ pathname: '/signup' }} state={{ role: 'driver' }} className="industry-roles-card industry-roles-card-light" style={{textDecoration: 'none', cursor: 'pointer'}}>
                <div className="industry-roles-card-icon industry-roles-card-icon-blue">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="industry-roles-card-title-dark">For Drivers</h3>
                  <p className="industry-roles-card-description-gray">Get hired faster with streamlined connections to carriers, effortlessly track your trips in real time, and securely upload.</p>
                </div>
              </Link>

              {/* For Shippers */}
              <Link to={{ pathname: '/signup' }} state={{ role: 'shipper' }} className="industry-roles-card industry-roles-card-light" style={{textDecoration: 'none', cursor: 'pointer'}}>
                <div className="industry-roles-card-icon industry-roles-card-icon-blue">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="industry-roles-card-title-dark">For Brokers/Shippers</h3>
                  <p className="industry-roles-card-description-gray">Easily post and manage your loads, monitor deliveries in real time with live tracking, and rate carriers to ensure quality, reliability.</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}