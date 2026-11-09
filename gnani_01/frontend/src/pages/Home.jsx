import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from "../styles/sm.png"
const Home = () => {
  const { user } = useAuth();

  return (
    <div className="home">
      <div className="hero">
        <div className="hero-content">
               <img
                     src={logo}
                     alt="SwachhMap Logo"
                     style={{
                       width: '50px',
                       height: 'px',
                       marginRight: '10px',
                       borderRadius: '6px',
                       objectFit: 'cover',
                     }}
                   />
          <h1 > SwachhMap</h1>
          <h2>Smart Civic Issue Reporting System</h2>
          <p>
            Empower your community by reporting civic issues like garbage, potholes, 
            waterlogging, and sanitation problems. Help make your city cleaner and better!
          </p>
          
          <div className="hero-actions">
            {user ? (
              <>
                <Link to="/report" className="btn btn-primary btn-large">
                  📍 Report an Issue
                </Link>
                <Link to="/map" className="btn btn-outline btn-large">
                  🗺️ View Map
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-large">
                  Get Started
                </Link>
                <Link to="/map" className="btn btn-outline btn-large">
                  View Issues
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="features">
        <div className="container">
          <h2>How It Works</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Report Issues</h3>
              <p>Take a photo and report civic issues with automatic location detection</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Interactive Map</h3>
              <p>View all reported issues on an interactive map with color-coded status pins</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-time Updates</h3>
              <p>Track the progress of reported issues from submission to resolution</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Community Driven</h3>
              <p>Join a community of citizens working together to improve their city</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="categories">
        <div className="container">
          <h2>Issue Categories</h2>
          <div className="categories-grid">
            <div className="category-card">
              <div className="category-icon">🗑️</div>
              <h3>Garbage</h3>
              <p>Overflowing bins, illegal dumping, waste management issues</p>
            </div>
            
            <div className="category-card">
              <div className="category-icon">🕳️</div>
              <h3>Potholes</h3>
              <p>Road damage, broken pavements, traffic safety hazards</p>
            </div>
            
            <div className="category-card">
              <div className="category-icon">💧</div>
              <h3>Waterlogging</h3>
              <p>Drainage issues, flooding, water stagnation problems</p>
            </div>
            
            <div className="category-card">
              <div className="category-icon">🚿</div>
              <h3>Sanitation</h3>
              <p>Public toilet issues, sewage problems, hygiene concerns</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;