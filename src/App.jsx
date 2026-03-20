import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import EmployerDashboard from './pages/EmployerDashboard.jsx'
import CreateAssessment from './pages/CreateAssessment.jsx'
import TakeAssessment from './pages/TakeAssessment.jsx'
import ViewResults from './pages/ViewResults.jsx'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-600">
        <Routes>
          <Route path="/" element={<EmployerDashboard />} />
          <Route path="/create" element={<CreateAssessment />} />
          <Route path="/assessment/:linkId" element={<TakeAssessment />} />
          <Route path="/results/:assessmentId" element={<ViewResults />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
