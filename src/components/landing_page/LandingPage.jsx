import Hero from './Hero'
import FreightPowerDifference from './FreightPowerDifference'
import IndustryRoles from './IndustryRoles'
import HowItWorks from './HowItWorks'
import FeaturesGrid from './FeaturesGrid'
import Pricing from './Pricing'
import TrustSection from './TrustSection'
import AiCoPilot from './AiCoPilot'
import FinalCTA from './FinalCTA'
import Footer from './Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <FreightPowerDifference />
      <IndustryRoles />
      <HowItWorks />
      <FeaturesGrid />
      <Pricing />
      <TrustSection />
      <AiCoPilot />
      <FinalCTA />
      <Footer />
    </div>
  )
}