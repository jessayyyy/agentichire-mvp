import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CreateAssessment() {
  const navigate = useNavigate()
  const [roleTitle, setRoleTitle] = useState('')
  const [questionBank, setQuestionBank] = useState([])
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [assessmentLink, setAssessmentLink] = useState('')
  
  const employerEmail = localStorage.getItem('employerEmail')

  useEffect(() => {
    if (!employerEmail) {
      navigate('/')
      return
    }
    loadQuestionBank()
  }, [])

  const loadQuestionBank = async () => {
    const { data, error } = await supabase
      .from('question_bank')
      .select('*')
      .order('category', { ascending: true })

    if (!error && data) {
      setQuestionBank(data)
    }
  }

  const toggleQuestion = (question) => {
    if (selectedQuestions.find(q => q.id === question.id)) {
      setSelectedQuestions(selectedQuestions.filter(q => q.id !== question.id))
    } else {
      if (selectedQuestions.length < 6) {
        setSelectedQuestions([...selectedQuestions, question])
      } else {
        alert('You can only select 6 questions')
      }
    }
  }

  const handleCreateAssessment = async () => {
    if (!roleTitle.trim()) {
      alert('Please enter a role title')
      return
    }

    if (selectedQuestions.length !== 6) {
      alert('Please select exactly 6 questions')
      return
    }

    setLoading(true)

    // Create assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .insert([{
        employer_email: employerEmail,
        role_title: roleTitle,
        selected_questions: selectedQuestions
      }])
      .select()
      .single()

    if (assessmentError) {
      alert('Error creating assessment')
      setLoading(false)
      return
    }

    // Generate unique link
    const linkId = crypto.randomUUID()
    const link = `${window.location.origin}/assessment/${linkId}`

    // Create initial candidate entry
    const { error: candidateError } = await supabase
      .from('candidates')
      .insert([{
        assessment_id: assessment.id,
        link_id: linkId,
        name: 'Pending',
        email: 'pending@example.com',
        status: 'pending'
      }])

    if (candidateError) {
      alert('Error generating link')
      setLoading(false)
      return
    }

    setAssessmentLink(link)
    setLoading(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(assessmentLink)
    alert('Link copied to clipboard!')
  }

  const groupedQuestions = questionBank.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = []
    }
    acc[question.category].push(question)
    return acc
  }, {})

  if (assessmentLink) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-green-600 mb-2">Assessment Created!</h2>
            <p className="text-gray-600">Share this link with your candidate</p>
          </div>

          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-600 mb-2">Assessment Link:</p>
            <p className="text-sm break-all font-mono bg-white p-3 rounded border">
              {assessmentLink}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyLink}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              📋 Copy Link
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-blue-600">Create New Assessment</h1>
        </div>

        {/* Role Title */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-lg font-semibold mb-2">Role Title</label>
          <input
            type="text"
            placeholder="e.g., Front Desk Associate, Customer Service Rep"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg"
          />
        </div>

        {/* Question Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">
            Select 6 Questions ({selectedQuestions.length}/6)
          </h2>

          {Object.entries(groupedQuestions).map(([category, questions]) => (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3 capitalize">
                {category.replace('_', ' ')}
              </h3>
              <div className="space-y-2">
                {questions.map((question) => {
                  const isSelected = selectedQuestions.find(q => q.id === question.id)
                  return (
                    <div
                      key={question.id}
                      onClick={() => toggleQuestion(question)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-1 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800">{question.question_text}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Difficulty: <span className="capitalize">{question.difficulty}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected Questions Preview */}
        {selectedQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Selected Questions</h2>
            <ol className="list-decimal list-inside space-y-2">
              {selectedQuestions.map((q, index) => (
                <li key={q.id} className="text-gray-700">
                  {q.question_text}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Create Button */}
        <button
          onClick={handleCreateAssessment}
          disabled={loading || selectedQuestions.length !== 6 || !roleTitle.trim()}
          className={`w-full py-4 rounded-lg font-bold text-lg transition ${
            loading || selectedQuestions.length !== 6 || !roleTitle.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Creating...' : 'Create Assessment & Generate Link'}
        </button>
      </div>
    </div>
  )
}
