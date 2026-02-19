import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/carrier/CarrierSignup.css'
import '../../styles/carrier/CarrierLogin.css'

// ✅ Import all images from src/assets instead of hardcoding /src paths
import carrier_ob_1 from '../../assets/carrier_ob_1.png'
import carrier_ob_2 from '../../assets/carrier_ob_2.jpg'
import carrier_ob_3 from '../../assets/carrier_ob_3.jpg'
import blue_bg_signup from '../../assets/blue_bg_signup.svg'
import pattern_bg_signup from '../../assets/pattern_bg_signup.svg'

export default function RoleSelection() {
  const [role, setRole] = useState('carrier')
  const navigate = useNavigate()

  const handleNext = () => {
    navigate('/signup', { state: { role } })
  }

  const images = [carrier_ob_1, carrier_ob_2, carrier_ob_3]
  const [currentImg, setCurrentImg] = useState(0)

  useEffect(() => {
    const interval = setInterval(
      () => setCurrentImg((p) => (p + 1) % images.length),
      2500
    )
    return () => clearInterval(interval)
  }, [images.length])

  return (
    <div className="carrier-signup-container carrier-login-page">
      {/* LEFT SIDE */}
      <div className="carrier-signup-left">
        <img
          src={pattern_bg_signup}
          alt="Pattern"
          className="carrier-signup-pattern-bg"
        />

        <div className="carrier-signup-form-bg">
          <h1 className="carrier-signup-title">
            Create Your FreightPower Account
          </h1>
          <p className="carrier-signup-subtitle">
            Manage, move, and monitor freight smarter
          </p>

          <div className="carrier-signup-form">
            <div className="carrier-signup-field">
              <label>Role Selection</label>
              <div className="role-options">
                <label
                  className={'role-option' + (role === 'carrier' ? ' selected' : '')}
                >
                  <input
                    type="radio"
                    name="role"
                    value="carrier"
                    checked={role === 'carrier'}
                    onChange={() => setRole('carrier')}
                  />
                  <span className="role-label">Carrier</span>
                  <span className="role-radio" aria-hidden="true" />
                </label>

                <label
                  className={'role-option' + (role === 'driver' ? ' selected' : '')}
                >
                  <input
                    type="radio"
                    name="role"
                    value="driver"
                    checked={role === 'driver'}
                    onChange={() => setRole('driver')}
                  />
                  <span className="role-label">Driver</span>
                  <span className="role-radio" aria-hidden="true" />
                </label>

                <label
                  className={'role-option' + (role === 'shipper' ? ' selected' : '')}
                >
                  <input
                    type="radio"
                    name="role"
                    value="shipper"
                    checked={role === 'shipper'}
                    onChange={() => setRole('shipper')}
                  />
                  <span className="role-label">Shipper/Broker</span>
                  <span className="role-radio" aria-hidden="true" />
                </label>
              </div>
            </div>

            <div className="carrier-signup-login-actions">
              <button
                type="button"
                className="carrier-signup-btn"
                onClick={handleNext}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="carrier-signup-right-bg-simple">
        <img
          src={blue_bg_signup}
          alt="Blue Background"
          className="carrier-signup-bg-svg"
        />
        <div className="carrier-signup-img-block">
          <img
            src={images[currentImg]}
            alt="Onboarding"
            className="carrier-signup-img-top-simple"
          />
        </div>

        <div className="carrier-signup-info-bottom">
          <div
            className="carrier-signup-img-indicators"
            style={{
              background: 'transparent',
              minHeight: '24px',
              marginBottom: '0',
              marginTop: '0',
            }}
          >
            {images.map((_, idx) => (
              <span
                key={idx}
                onClick={() => setCurrentImg(idx)}
                className={
                  idx === currentImg
                    ? 'carrier-signup-dot-active'
                    : 'carrier-signup-dot'
                }
                style={{
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          <div className="carrier-signup-info-simple">
            <h2>
              Onboard Faster,
              <br />
              Manage Smarter with AI
            </h2>
            <ul>
              <li>
                Connect instantly, automate your documents, and move freight
                smarter in one intelligent digital marketplace.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
