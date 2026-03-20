import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ViewResults() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  useEffect(() => {
    loadResults()
  }, [assessmentId])

  const loadResults = async () => {
    setLoading(true)

    // Load assessment
    const { data: assessmentData } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single()

    setAssessment(assessmentData)

    // Load candidates
    const { data: candidatesData } = await supabase
      .from('candidates')
      .select('*')
      .eq('assessment_id', assessmentId)
      .neq('status', 'pending')
      .order('completed_at', { ascending: false })

    // Load responses for each candidate
    const candidatesWithResponses = await Promise.all(
      (candidatesData || []).map(async (candidate) => {
        const { data: responses } = await supabase
          .from('responses')
          .select('*')
          .eq('candidate_id', candidate.id)
          .order('question_number', { ascending: true })

        const avgScore = responses && responses.length > 0
          ? responses.reduce((sum, r) => sum + (r.ai_score || 0), 0) / responses.length
          : 0

        return {
          ...candidate,
          responses: responses || [],
          avgScore: avgScore
        }
      })
    )

    setCandidates(candidatesWithResponses)
    setLoading(false)
  }

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getRecommendation = (avgScore) => {
    if (avgScore >= 8) return { text: 'Strong Candidate - Proceed to Interview', color: 'text-green-600' }
    if (avgScore >= 6) return { text: 'Moderate Fit - Phone Screen Recommended', color: 'text-yellow-600' }
    return { text: 'Not Recommended', color: 'text-red-600' }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-xl text-white">Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-blue-600">Assessment Results</h1>
          <p className="text-gray-600">Role: {assessment?.role_title}</p>
        </div>

        {/* Candidates List */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Candidate Cards */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">
              Candidates ({candidates.length})
            </h2>

            {candidates.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500">No completed assessments yet.</p>
              </div>
            ) : (
              candidates.map((candidate) => {
                const recommendation = getRecommendation(candidate.avgScore)
                return (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition hover:shadow-lg ${
                      selectedCandidate?.id === candidate.id ? 'ring-2 ring-blue-600' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{candidate.name}</h3>
                        <p className="text-sm text-gray-600">{candidate.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Overall Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(candidate.avgScore)}`}>
                          {candidate.avgScore.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className={`font-semibold ${recommendation.color}`}>
                        {recommendation.text}
                      </p>
                    </div>

                    <div className="flex gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Status:</span>{' '}
                        <span className="capitalize">{candidate.status}</span>
                      </div>
                      {candidate.completed_at && (
                        <div>
                          <span className="font-medium">Completed:</span>{' '}
                          {new Date(candidate.completed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button className="mt-3 text-blue-600 text-sm font-medium hover:text-blue-700">
                      View Detailed Results →
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Right: Detailed View */}
          <div className="sticky top-6">
            {selectedCandidate ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  {selectedCandidate.name}'s Responses
                </h2>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Overall Score</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedCandidate.avgScore.toFixed(1)}/10
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Questions Answered</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {selectedCandidate.responses.length}/6
                      </p>
                    </div>
                  </div>
                </div>

                {/* Individual Responses */}
                <div className="space-y-6 max-h-[600px] overflow-y-auto">
                  {selectedCandidate.responses.map((response, index) => (
                    <div key={response.id} className="border-b border-gray-200 pb-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-gray-700">
                          Question {response.question_number}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          getScoreColor(response.ai_score || 0)
                        }`}>
                          {response.ai_score ? response.ai_score.toFixed(1) : 'N/A'}/10
                        </span>
                      </div>

                      <p className="text-gray-800 mb-3 font-medium">
                        {response.question_text}
                      </p>

                      <div className="bg-gray-50 p-3 rounded mb-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {response.answer_text}
                        </p>
                      </div>

                      {response.ai_feedback && (
                        <div className="bg-blue-50 p-3 rounded mb-3">
                          <p className="text-sm font-semibold text-blue-900 mb-1">
                            AI Feedback:
                          </p>
                          <p className="text-sm text-blue-800">
                            {response.ai_feedback}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-4 text-xs text-gray-500">
                        <div>
                          ⏱️ Typing time: {Math.floor(response.typing_time_seconds / 60)}m {response.typing_time_seconds % 60}s
                        </div>
                        <div>
                          ⏸️ Pauses: {response.typing_pauses}
                        </div>
                        <div>
                          ⌫ Deletions: {response.deletion_count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-2">Summary</h3>
                  <p className={`font-semibold mb-2 ${getRecommendation(selectedCandidate.avgScore).color}`}>
                    {getRecommendation(selectedCandidate.avgScore).text}
                  </p>
                  
                  {selectedCandidate.avgScore >= 6 && (
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm text-green-800">
                        <strong>Strengths:</strong> This candidate demonstrates good communication 
                        and provided specific examples in their responses.
                      </p>
                    </div>
                  )}
                  
                  {selectedCandidate.avgScore < 6 && (
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-sm text-yellow-800">
                        <strong>Areas of concern:</strong> Responses were somewhat vague and lacked 
                        specific examples. Consider if additional screening is needed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-5xl mb-4">👈</div>
                <p className="text-gray-600">
                  Select a candidate to view detailed results
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
