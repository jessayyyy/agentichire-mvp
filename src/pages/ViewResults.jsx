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

    // Load candidates (only completed ones)
    const { data: candidatesData } = await supabase
      .from('candidates')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('status', 'completed')
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

    // Sort by score (highest first)
    candidatesWithResponses.sort((a, b) => b.avgScore - a.avgScore)

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

        {/* Leaderboard View */}
        <div className="space-y-6">
          {/* Leaderboard Header */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Candidate Leaderboard</h2>
                <p className="text-gray-600">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''} assessed</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Top Score</p>
                <p className="text-3xl font-bold text-blue-600">
                  {candidates.length > 0 ? candidates[0].avgScore.toFixed(1) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Leaderboard Table */}
            {candidates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No candidates yet.</p>
                <p className="text-gray-400 text-sm mt-2">Share the assessment link to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Rank</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Score</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Completed</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate, index) => {
                      const recommendation = getRecommendation(candidate.avgScore)
                      const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''
                      
                      return (
                        <tr 
                          key={candidate.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                            selectedCandidate?.id === candidate.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <td className="py-4 px-4">
                            <span className="text-lg font-bold text-gray-700">
                              {rankEmoji} #{index + 1}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-semibold text-gray-800">{candidate.name}</p>
                              <p className="text-xs text-gray-500">{candidate.email}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-2xl font-bold ${getScoreColor(candidate.avgScore)}`}>
                              {candidate.avgScore.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-xs font-semibold ${recommendation.color}`}>
                              {candidate.avgScore >= 7 ? '✓ Strong' : candidate.avgScore >= 5 ? '~ Moderate' : '✗ Weak'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600">
                            {candidate.completed_at 
                              ? new Date(candidate.completed_at).toLocaleDateString()
                              : 'In progress'}
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => setSelectedCandidate(candidate)}
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                            >
                              View Details →
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed View (shown when candidate selected) */}
          {selectedCandidate && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedCandidate.name}'s Detailed Results
                  </h2>
                  <p className="text-gray-600">{selectedCandidate.email}</p>
                </div>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-gray-600 text-sm">Overall Score</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {selectedCandidate.avgScore.toFixed(1)}/10
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Questions Answered</p>
                    <p className="text-3xl font-bold text-gray-800">
                      {selectedCandidate.responses.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Rank</p>
                    <p className="text-3xl font-bold text-purple-600">
                      #{candidates.findIndex(c => c.id === selectedCandidate.id) + 1}
                    </p>
                  </div>
                </div>
              </div>

              {/* Individual Responses */}
              <div className="space-y-6 max-h-[600px] overflow-y-auto">
                {selectedCandidate.responses.map((response) => (
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
    ⏱️ Time: {Math.floor(response.typing_time_seconds / 60)}m {response.typing_time_seconds % 60}s
  </div>
  <div>
    ⏸️ Pauses: {response.typing_pauses}
  </div>
  <div>
    ⌫ Edits: {response.deletion_count}
  </div>
  <div className={response.copy_paste_attempts > 0 ? 'text-red-600 font-semibold' : ''}>
    📋 Copy attempts: {response.copy_paste_attempts || 0}
    {response.copy_paste_attempts > 3 && ' ⚠️'}
  </div>
</div>

              {/* Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2">Hiring Recommendation</h3>
                <p className={`font-semibold text-lg ${getRecommendation(selectedCandidate.avgScore).color}`}>
                  {getRecommendation(selectedCandidate.avgScore).text}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
