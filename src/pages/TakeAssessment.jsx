import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function TakeAssessment() {
  const { linkId } = useParams()
  const [stage, setStage] = useState('loading') // loading, info, assessment, completed
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [assessment, setAssessment] = useState(null)
  const [candidateId, setCandidateId] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answer, setAnswer] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(20 * 60) // 20 minutes in seconds
  const [typingStats, setTypingStats] = useState({
    pauses: 0,
    deletions: 0,
    startTime: null,
    lastKeystroke: null
  })

  useEffect(() => {
    loadAssessment()
  }, [linkId])

  useEffect(() => {
    if (stage === 'assessment' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [stage, timeRemaining])

  const loadAssessment = async () => {
    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('*, assessments(*)')
      .eq('link_id', linkId)
      .single()

    if (error || !candidate) {
      setStage('error')
      return
    }

    if (candidate.status === 'completed') {
      setStage('already_completed')
      return
    }

    setAssessment(candidate.assessments)
    setCandidateId(candidate.id)
    setStage('info')
  }

  const handleStart = async () => {
    if (!candidateName.trim() || !candidateEmail.trim()) {
      alert('Please enter your name and email')
      return
    }

    // Update candidate info
    await supabase
      .from('candidates')
      .update({
        name: candidateName,
        email: candidateEmail,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', candidateId)

    setStage('assessment')
    setTypingStats({ ...typingStats, startTime: Date.now() })
  }

  const handleKeyDown = (e) => {
    const now = Date.now()

    // Track deletions
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setTypingStats(prev => ({
        ...prev,
        deletions: prev.deletions + 1
      }))
    }

    // Track pauses (>3 seconds between keystrokes)
    if (typingStats.lastKeystroke && now - typingStats.lastKeystroke > 3000) {
      setTypingStats(prev => ({
        ...prev,
        pauses: prev.pauses + 1
      }))
    }

    setTypingStats(prev => ({
      ...prev,
      lastKeystroke: now
    }))
  }

  const handlePaste = (e) => {
    e.preventDefault()
    alert('⚠️ Copy-paste is disabled for fair assessment')
  }

  const handleNextQuestion = async () => {
    if (answer.trim().length < 50) {
      alert('Please write at least 50 characters')
      return
    }

    const typingTime = Math.floor((Date.now() - typingStats.startTime) / 1000)

    // Save response
    await supabase
      .from('responses')
      .insert([{
        candidate_id: candidateId,
        question_number: currentQuestion + 1,
        question_text: assessment.selected_questions[currentQuestion].question_text,
        answer_text: answer,
        typing_pauses: typingStats.pauses,
        deletion_count: typingStats.deletions,
        typing_time_seconds: typingTime
      }])

    // Move to next question or finish
    if (currentQuestion < 5) {
      setCurrentQuestion(currentQuestion + 1)
      setAnswer('')
      setTypingStats({
        pauses: 0,
        deletions: 0,
        startTime: Date.now(),
        lastKeystroke: null
      })
    } else {
      handleSubmitAssessment()
    }
  }

  const handleSubmitAssessment = async () => {
    await supabase
      .from('candidates')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', candidateId)

    // Trigger AI scoring (we'll add this later)
    await scoreAllAnswers()

    setStage('completed')
  }

  const handleAutoSubmit = async () => {
    // Save current answer if there is one
    if (answer.trim().length > 0) {
      const typingTime = Math.floor((Date.now() - typingStats.startTime) / 1000)
      await supabase
        .from('responses')
        .insert([{
          candidate_id: candidateId,
          question_number: currentQuestion + 1,
          question_text: assessment.selected_questions[currentQuestion].question_text,
          answer_text: answer,
          typing_pauses: typingStats.pauses,
          deletion_count: typingStats.deletions,
          typing_time_seconds: typingTime
        }])
    }

    handleSubmitAssessment()
  }

  const scoreAllAnswers = async () => {
    // Get all responses for this candidate
    const { data: responses } = await supabase
      .from('responses')
      .select('*')
      .eq('candidate_id', candidateId)

    if (!responses || responses.length === 0) return

    // Score each response using Claude API
    for (const response of responses) {
      try {
        const questionData = assessment.selected_questions.find(
          q => q.question_text === response.question_text
        )

        const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 400,
            messages: [{
              role: "user",
              content: `You are evaluating a hiring assessment answer for a customer service role.

Question: ${response.question_text}
Ideal answer should include: ${questionData?.ideal_answer_hints || 'Specific examples, professionalism, problem-solving'}
Candidate's answer: ${response.answer_text}

Evaluate based on:
1. Relevance to question
2. Specific examples vs vague statements
3. Professionalism and communication
4. Depth of thinking

Return ONLY valid JSON (no markdown, no backticks):
{
  "score": 7.5,
  "feedback": "Brief 2-3 sentence evaluation explaining the score"
}`
            }]
          })
        })

        const data = await aiResponse.json()
        const evaluation = JSON.parse(data.content[0].text)

        // Update response with AI score
        await supabase
          .from('responses')
          .update({
            ai_score: evaluation.score,
            ai_feedback: evaluation.feedback
          })
          .eq('id', response.id)

      } catch (error) {
        console.error('Error scoring answer:', error)
        // If AI fails, set default score
        await supabase
          .from('responses')
          .update({
            ai_score: 5.0,
            ai_feedback: 'AI scoring temporarily unavailable. Manual review recommended.'
          })
          .eq('id', response.id)
      }
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Loading state
  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-xl text-white">Loading assessment...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (stage === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Invalid Link</h2>
          <p className="text-gray-600">This assessment link is not valid or has expired.</p>
        </div>
      </div>
    )
  }

  // Already completed state
  if (stage === 'already_completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Already Completed</h2>
          <p className="text-gray-600">This assessment has already been submitted.</p>
        </div>
      </div>
    )
  }

  // Info/Start screen
  if (stage === 'info') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">AgenticHire Assessment</h1>
          <h2 className="text-xl text-gray-700 mb-6">Role: {assessment.role_title}</h2>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
            <h3 className="font-bold text-blue-900 mb-2">Instructions:</h3>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>You have <strong>20 minutes</strong> to complete 6 questions</li>
              <li>Copy-paste is disabled for fairness</li>
              <li>Answer each question with at least 50 characters</li>
              <li>Be specific and honest in your responses</li>
              <li>Timer will auto-submit when time expires</li>
            </ul>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Your Name</label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Your Email</label>
              <input
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 transition"
          >
            Start Assessment
          </button>
        </div>
      </div>
    )
  }

  // Assessment in progress
  if (stage === 'assessment') {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          {/* Timer and Progress */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Question {currentQuestion + 1} of 6</p>
                <div className="w-64 h-2 bg-gray-200 rounded-full mt-2">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${((currentQuestion + 1) / 6) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Time Remaining</p>
                <p className={`text-3xl font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`}>
                  {formatTime(timeRemaining)}
                </p>
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {assessment.selected_questions[currentQuestion].question_text}
            </h2>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              placeholder="Type your answer here... (minimum 50 characters)"
              className="w-full h-64 px-4 py-3 border-2 border-gray-300 rounded-lg text-lg resize-none focus:border-blue-500 focus:outline-none"
            />

            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-600">
                Characters: {answer.length} {answer.length < 50 && `(${50 - answer.length} more needed)`}
              </p>
              <button
                onClick={handleNextQuestion}
                disabled={answer.trim().length < 50}
                className={`px-8 py-3 rounded-lg font-semibold transition ${
                  answer.trim().length < 50
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {currentQuestion < 5 ? 'Next Question →' : 'Submit Assessment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Completed state
  if (stage === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-green-600 mb-4">Assessment Complete!</h2>
          <p className="text-gray-700 mb-2">Thank you for completing the assessment.</p>
          <p className="text-gray-600 text-sm">
            Your responses are being analyzed. The employer will review your results and contact you if selected.
          </p>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">You may now close this window.</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
