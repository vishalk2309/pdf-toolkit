import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import BgShapes from './components/BgShapes.jsx'
import Footer from './components/Footer.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import RouteMeta from './components/RouteMeta.jsx'
import ConversionTool from './components/ConversionTool.jsx'
import { conversionTools } from './toolsConfig.js'
import Home from './pages/Home.jsx'
import Merge from './pages/Merge.jsx'
import Split from './pages/Split.jsx'
import Compress from './pages/Compress.jsx'
import Protect from './pages/Protect.jsx'
import Edit from './pages/Edit.jsx'
import Annotate from './pages/Annotate.jsx'
import Sign from './pages/Sign.jsx'
import ExcalidrawToPdf from './pages/ExcalidrawToPdf.jsx'
import FAQ from './pages/FAQ.jsx'
import Features from './pages/Features.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import AccountSettings from './pages/AccountSettings.jsx'
import Signatures from './pages/Signatures.jsx'
import YourFiles from './pages/YourFiles.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <RouteMeta />
      <BgShapes />
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Config-driven conversion tools share one component */}
          {conversionTools.map((t) => (
            <Route
              key={t.path}
              path={t.path}
              element={<ConversionTool config={t} />}
            />
          ))}

          {/* Custom tools with their own pages */}
          <Route path="/merge" element={<Merge />} />
          <Route path="/split" element={<Split />} />
          <Route path="/compress" element={<Compress />} />
          <Route path="/protect" element={<Protect />} />
          <Route path="/edit" element={<Edit />} />
          <Route path="/annotate" element={<Annotate />} />
          <Route path="/sign" element={<Sign />} />
          <Route path="/excalidraw-to-pdf" element={<ExcalidrawToPdf />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/features" element={<Features />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/signatures" element={<Signatures />} />
          <Route path="/files" element={<YourFiles />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
