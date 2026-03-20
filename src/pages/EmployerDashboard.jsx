import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function EmployerDashboard() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [employerEmail, setEmployerEmail] = useState('')
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedEmail = localStorage.getItem('employerEmail')
    if (savedEmail) {
      setEmployerEmail(savedEmail)
      setIsLoggedIn(true)
      loadAssessments(savedEmail)
    }
  }, [])

  const loadAssessments = async (email) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('employer_email', email)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAssessments(data)
    }
    setLoading(false)
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (email.includes('@')) {
      localStorage.setItem('employerEmail', email)
      setEmployerEmail(email)
      setIsLoggedIn(true)
      loadAssessments(email)
    } else {
      alert('Please enter a valid email')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('employerEmail')
    setIsLoggedIn(false)
    setEmployerEmail('')
    setAssessments([])
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">AgenticHire</h1>
          <p className="text-gray-600 mb-6">Employer Login</p>
          
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 text-lg"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Login
            </button>
          </form>
          
          <p className="text-sm text-gray-500 mt-4">
            For MVP: Just enter your email (no password needed)
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-blue-600">AgenticHire</h1>
              <p className="text-gray-600">Welcome, {employerEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Create Assessment Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/create')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
          >
            + Create New Assessment
          </button>
        </div>

        {/* Assessments List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">Your Assessments</h2>
          
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : assessments.length === 0 ? (
            <p className="text-gray-500">No assessments yet. Create your first one!</p>
          ) : (
            <div className="space-y-4">
              {assessments.map((assessment) => (
                <AssessmentCard 
                  key={assessment.id} 
                  assessment={assessment}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AssessmentCard({ assessment, navigate, onDelete }) {
  const [candidateCount, setCandidateCount] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadCandidateCount()
  }, [])

  const loadCandidateCount = async () => {
    const { count } = await supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('assessment_id', assessment.id)
      .eq('status', 'completed')
    
    setCandidateCount(count || 0)
  }

const handleDelete = async () => {
  setIsDeleting(true)

  try {
    // Delete all responses for this assessment's candidates
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id')
      .eq('assessment_id', assessment.id)

    if (candidates && candidates.length > 0) {
      const candidateIds = candidates.map(c => c.id)
      
      const { error: responsesError } = await supabase
        .from('responses')
        .delete()
        .in('candidate_id', candidateIds)

      if (responsesError) {
        console.error('Error deleting responses:', responsesError)
      }
    }

    // Delete all candidates
    const { error: candidatesError } = await supabase
      .from('candidates')
      .delete()
      .eq('assessment_id', assessment.id)

    if (candidatesError) {
      console.error('Error deleting candidates:', candidatesError)
    }

    // Delete the assessment
    const { error: assessmentError } = await supabase
      .from('assessments')
      .delete()
      .eq('id', assessment.id)

    if (assessmentError) {
      throw new Error(assessmentError.message)
    }

    setShowDeleteConfirm(false)
    setIsDeleting(false)
    
    // Refresh the list
    onDelete()

  } catch (error) {
    console.error('Error deleting assessment:', error)
    alert(`Error: ${error.message}`)
    setIsDeleting(false)
  }
}

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition relative">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Assessment?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "<strong>{assessment.role_title}</strong>"?
              <br/><br/>
              This will permanently delete:
              <br/>• The assessment
              <br/>• All {candidateCount} candidate responses
              <br/>• All associated data
              <br/><br/>
              <strong className="text-red-600">This action cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:bg-gray-400"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Card Content */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-800">
            {assessment.role_title}
          </h3>
          <p className="text-sm text-gray-500">
            Created {new Date(assessment.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            {candidateCount} candidate{candidateCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"
            title="Delete assessment"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => navigate(`/results/${assessment.id}`)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          View Results
        </button>
        <button
          onClick={() => {
            const link = `${window.location.origin}/assessment/${assessment.id}`
            navigator.clipboard.writeText(link)
            alert('Assessment link copied to clipboard!')
          }}
          className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition"
        >
          Copy Link
        </button>
      </div>
    </div>
  )
}
