import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import { VoiceActivationProvider } from './context/VoiceActivationContext';
import SiriAssistantModal from './components/SiriAssistant/SiriAssistantModal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Register from './pages/Register';
import Report from './pages/Report';
import Map from './pages/Map';
import MyReportsSafe from './pages/MyReportsSafe';
import Admin from './pages/Admin';
import SimpleTest from './pages/SimpleTest';
import About from './pages/About';
import Contact from './pages/Contact';
import Developer from './pages/Developer';

function App() {
  return (
    <AuthProvider>
      <VoiceActivationProvider>
        <Router>
          <div style={styles.app}>
            <Navbar />
            <main style={styles.mainContent}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/register" element={<Register />} />
                <Route path="/map" element={<Map />} />
                <Route path="/report" element={<Report />} />
                <Route path="/my-reports" element={<MyReportsSafe />} />
                
                {/* Admin Routes: Protected & Accessible ONLY to Authorized Administrators */}
                <Route 
                  path="/admin/dashboard" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <Admin />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <Admin />
                    </ProtectedRoute>
                  } 
                />
                
                <Route path="/simple-test" element={<SimpleTest />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/developer" element={<Developer />} />
              </Routes>
            </main>
            <Footer />
            
            {/* Global Siri-style Voice Assistant Modal */}
            <SiriAssistantModal />

            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </div>
        </Router>
      </VoiceActivationProvider>
    </AuthProvider>
  );
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh'
  },
  mainContent: {
    flex: 1
  }
};

export default App;