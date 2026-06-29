import SEO from '../ui/SEO'
import Hero from '../home/Hero'
import ToolCategoriesSection from '../home/ToolCategoriesSection'
import FeaturesSection from '../home/FeaturesSection'
import StatsSection from '../home/StatsSection'
import TestimonialsSection from '../home/TestimonialsSection'
import FAQSection from '../home/FAQSection'

export default function HomePage() {
  return (
    <>
      <SEO
        title="PDF Master — Every PDF & Image Tool You Need"
        description="Convert, merge, split, compress and edit PDFs and images securely in your browser. Free, fast, and no sign-up required."
        keywords="PDF tools, merge PDF, split PDF, compress PDF, image converter, free online PDF editor"
        canonical="/"
      />

      <Hero />
      <StatsSection />
      <ToolCategoriesSection />
      <FeaturesSection />
      <TestimonialsSection />
      <FAQSection />
    </>
  )
}
