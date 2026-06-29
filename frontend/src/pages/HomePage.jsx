import { Helmet } from 'react-helmet-async'
import Hero from '../home/Hero'
import ToolCategoriesSection from '../home/ToolCategoriesSection'
import FeaturesSection from '../home/FeaturesSection'
import StatsSection from '../home/StatsSection'
import TestimonialsSection from '../home/TestimonialsSection'
import FAQSection from '../home/FAQSection'

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>PDF Master — Every PDF &amp; Image Tool You Need</title>
        <meta
          name="description"
          content="Convert, merge, split, compress and edit PDFs and images securely in your browser. Free, fast, and no sign-up required."
        />
      </Helmet>

      <Hero />
      <StatsSection />
      <ToolCategoriesSection />
      <FeaturesSection />
      <TestimonialsSection />
      <FAQSection />
    </>
  )
}
