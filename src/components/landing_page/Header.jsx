import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/landing_page/header.css';
import logo from '/src/assets/logo.png';
import resp_logo from '/src/assets/logo_1.png';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const scrollContainerRef = useRef(null);

  // Detect the real scrollable container (window or a div)
  useEffect(() => {
    // Find the first scrollable parent
    function getScrollableParent(node) {
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
          return node;
        }
        node = node.parentElement;
      }
      return window;
    }

    // Use the main app/root container as a starting point
    const main = document.querySelector('.min-h-screen') || document.body;
    const scrollable = getScrollableParent(main);
    scrollContainerRef.current = scrollable;

    const handleScroll = () => {
      const scrollTop = scrollable === window ? window.scrollY : scrollable.scrollTop;
      setIsScrolled(scrollTop > 10);
    };

    if (scrollable === window) {
      window.addEventListener('scroll', handleScroll);
    } else {
      scrollable.addEventListener('scroll', handleScroll);
    }
    // Run once to set initial state
    handleScroll();
    return () => {
      if (scrollable === window) {
        window.removeEventListener('scroll', handleScroll);
      } else {
        scrollable.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  useEffect(() => {
    const ids = ['features','how-it-works','testimonials','about','pricing'];
    const sections = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (!sections.length) return;

    // Account for fixed header by calculating header height at runtime and using a negative top rootMargin.
    // Use multiple thresholds and pick the section with the largest intersectionRatio to determine the active section.
    const headerEl = document.querySelector('.landing-header');
    const headerHeight = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 64; // px
    const scrollable = scrollContainerRef.current || null;
    let observer;
    if (sections.length) {
      observer = new window.IntersectionObserver((entries) => {
        // Find the entry with the largest intersectionRatio
        let maxEntry = null;
        entries.forEach(entry => {
          if (!maxEntry || entry.intersectionRatio > maxEntry.intersectionRatio) {
            maxEntry = entry;
          }
        });
        if (maxEntry && maxEntry.isIntersecting) {
          setActiveSection(maxEntry.target.id);
        }
      }, { root: scrollable === window ? null : scrollable, rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: [0, 0.25, 0.5, 0.75, 1] });
      sections.forEach(s => observer.observe(s));
    }

    // Fallback: update activeSection on scroll, but debounce and only update if section is in view
    let fallbackTimeout = null;
    const fallbackScrollHandler = () => {
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      fallbackTimeout = setTimeout(() => {
        const scrollTop = scrollable === window ? window.scrollY : scrollable.scrollTop;
        const headerH = headerHeight;
        const scrollPosition = scrollTop + headerH + 2;
        let found = null;
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          const top = s.offsetTop;
          const bottom = top + s.offsetHeight;
          if (scrollPosition >= top && scrollPosition < bottom) {
            found = s;
            break;
          }
        }
        if (found && found.id && activeSection !== found.id) {
          setActiveSection(found.id);
        }
      }, 50); // debounce for 50ms
    };
    if (scrollable) {
      scrollable.addEventListener('scroll', fallbackScrollHandler);
    }
    // Run once to set initial active
    fallbackScrollHandler();

    return () => {
      if (observer) observer.disconnect();
      if (scrollable) scrollable.removeEventListener('scroll', fallbackScrollHandler);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [scrollContainerRef, activeSection]);

  // Removed duplicate fallback useEffect to prevent conflicting nav highlight updates.

  const handleNavClick = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
    // close mobile menu if open
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={`landing-header ${isScrolled ? 'scrolled' : 'transparent'}`}>
      <div className="landing-header-container">
        <div className="landing-header-content">
          {/* Logo */}
          <div className="landing-logo">
            <Link 
              to="/" 
              className="landing-logo-text"
              onClick={() => {
                const scrollable = scrollContainerRef.current || window;
                if (scrollable === window) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  scrollable.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
            >
              {/* Desktop / large-screen logo */}
              <img src={logo} alt="FreightPower" className="landing-logo-image desktop-logo" />
              {/* Responsive compact logo shown at <=768px */}
              <img src={resp_logo} alt="FreightPower" className="landing-logo-image mobile-logo" />
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="landing-nav">
            <a href="#features" onClick={(e) => handleNavClick(e, 'features')} className={`landing-nav-link ${activeSection === 'features' ? 'active' : ''} ${isScrolled ? 'scrolled' : 'transparent'}`}>
              Features
            </a>
            <a href="#how-it-works" onClick={(e) => handleNavClick(e, 'how-it-works')} className={`landing-nav-link ${activeSection === 'how-it-works' ? 'active' : ''} ${isScrolled ? 'scrolled' : 'transparent'}`}>
              How it Works
            </a>
            <a href="#testimonials" onClick={(e) => handleNavClick(e, 'testimonials')} className={`landing-nav-link ${activeSection === 'testimonials' ? 'active' : ''} ${isScrolled ? 'scrolled' : 'transparent'}`}>
              Marketplace
            </a>
            <a href="#about" onClick={(e) => handleNavClick(e, 'about')} className={`landing-nav-link ${activeSection === 'about' ? 'active' : ''} ${isScrolled ? 'scrolled' : 'transparent'}`}>
              About Us
            </a>
            <a href="#pricing" onClick={(e) => handleNavClick(e, 'pricing')} className={`landing-nav-link ${activeSection === 'pricing' ? 'active' : ''} ${isScrolled ? 'scrolled' : 'transparent'}`}>
              Pricing
            </a>
          </nav>

          {/* CTA Button */}
          <div className="cta-section">
            <Link to="/login" className="login-button">
              Login
            </Link>
            <Link to="/select-role" className="signup-button">
              Sign up
            </Link>

            {/* Mobile menu button */}
            <button 
              className={`mobile-menu-button ${isScrolled ? 'scrolled' : 'transparent'}`}
              onClick={toggleMobileMenu}
            >
              <svg className={`mobile-menu-icon ${isScrolled ? 'scrolled' : 'transparent'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="mobile-nav">
            <nav className="mobile-nav-content">
              <a href="#features" className={`mobile-nav-link ${activeSection === 'features' ? 'active' : ''}`} onClick={(e) => { handleNavClick(e, 'features'); }}>
                Features
              </a>
              <a href="#how-it-works" className={`mobile-nav-link ${activeSection === 'how-it-works' ? 'active' : ''}`} onClick={(e) => { handleNavClick(e, 'how-it-works'); }}>
                How it Works
              </a>
              <a href="#testimonials" className={`mobile-nav-link ${activeSection === 'testimonials' ? 'active' : ''}`} onClick={(e) => { handleNavClick(e, 'testimonials'); }}>
                Testimonials
              </a>
              <a href="#about" className={`mobile-nav-link ${activeSection === 'about' ? 'active' : ''}`} onClick={(e) => { handleNavClick(e, 'about'); }}>
                About
              </a>
              <a href="#pricing" className={`mobile-nav-link ${activeSection === 'pricing' ? 'active' : ''}`} onClick={(e) => { handleNavClick(e, 'pricing'); }}>
                Pricing
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}