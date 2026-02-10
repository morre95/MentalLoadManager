import Navbar from "../components/landing/Navbar";
import HeroSection from "../components/landing/HeroSection";
import DashboardPreview from "../components/landing/DashboardPreview";
import Footer from "../components/landing/Footer";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <p>HELLO FROM INDEX</p>
        <HeroSection />
        <DashboardPreview />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
