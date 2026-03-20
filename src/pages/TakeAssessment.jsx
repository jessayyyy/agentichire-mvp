import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function TakeAssessment() {
  const { linkId } = useParams()
  const [stage, setStage] = useState('loading')
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [assessment, setAssessment] = useState(null)
  const [candidateId, setCandidateId] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answer, setAnswer] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(20 * 60)
  const [allQuestions, setAllQuestions] = useState([])
  const [adaptiveQuestionsGenerated, setAdaptiveQuestionsGenerated] = useState(false)
  const [isGeneratingAdaptive, setIsGeneratingAdaptive] = useState(false)
  const [totalQuestions, setTotalQuestions] = useState(null)
  const [copyPasteAttempts, setCopyPasteAttempts] = useState(0)
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
    const assessmentId = linkId

    console.log('Loading assessment:', assessmentId)

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single()

    console.log('Assessment data:', assessment)
    console.log('Assessment error:', assessmentError)

    if (assessmentError || !assessment) {
      console.error('Failed to load assessment')
      setStage('error')
      return
    }

    console.log('Selected questions:', assessment.selected_questions)

    setAssessment(assessment)
    setAllQuestions(assessment.selected_questions || [])
    setStage('info')
  }

  const handleStart = async () => {
    if (!candidateName.trim() || !candidateEmail.trim()) {
      alert('Please enter your name and email')
      return
    }

    const { data: existingCandidate } = await supabase
      .from('candidates')
      .select('*')
      .eq('assessment_id', linkId)
      .eq('email', candidateEmail.toLowerCase().trim())
      .maybeSingle()

    if (existingCandidate) {
      if (existingCandidate.status === 'completed') {
        alert('This email has already completed this assessment. Please contact the employer if you believe this is an error.')
        return
      } else if (existingCandidate.status === 'in_progress') {
        setCandidateId(existingCandidate.id)
        setStage('assessment')
        setTypingStats({ ...typingStats, startTime: Date.now() })
        return
      }
    }

    const { data: newCandidate, error: candidateError } = await supabase
      .from('candidates')
      .insert([{
        assessment_id: linkId,
        name: candidateName,
        email: candidateEmail.toLowerCase().trim(),
        link_id: crypto.randomUUID(),
        status: 'in_progress',
        started_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (candidateError || !newCandidate) {
      alert('Error starting assessment. Please try again.')
      console.error(candidateError)
      return
    }

    setCandidateId(newCandidate.id)
    setStage('assessment')
    setTypingStats({ ...typingStats, startTime: Date.now() })
  }

  const handleKeyDown = (e) => {
    const now = Date.now()

    if (e.key === 'Backspace' || e.key === 'Delete') {
      setTypingStats(prev => ({
        ...prev,
        deletions: prev.deletions + 1
      }))
    }

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
    setCopyPasteAttempts(prev => prev + 1)
  }

  const analyzeAnswerQuality = (answerText) => {
    let qualityScore = 5

    const wordCount = answerText.split(' ').filter(w => w.length > 0).length
    if (wordCount < 20) qualityScore -= 2
    else if (wordCount > 80) qualityScore += 1

    const exampleIndicators = [
      'for example', 'for instance', 'one time', 'last week', 'last month',
      'i remember', 'there was', 'i once', 'in my previous', 'when i worked'
    ]
    const hasExample = exampleIndicators.some(indicator =>
      answerText.toLowerCase().includes(indicator)
    )
    if (!hasExample) qualityScore -= 1.5

    const vagueWords = ['maybe', 'probably', 'i think', 'i guess', 'kind of', 'sort of']
    const vagueCount = vagueWords.filter(word =>
      answerText.toLowerCase().includes(word)
    ).length
    if (vagueCount > 2) qualityScore -= 1

    const genericPhrases = [
      'i would', 'i will', 'i believe', 'my approach would be',
      'i typically', 'generally'
    ]
    const genericCount = genericPhrases.filter(phrase =>
      answerText.toLowerCase().includes(phrase)
    ).length
    if (genericCount > 3) qualityScore -= 1

    const sentences = answerText.split(/[.!?]+/).filter(s => s.trim().length > 10)
    if (sentences.length < 2) qualityScore -= 1
    else if (sentences.length > 5) qualityScore += 0.5

    return Math.max(1, Math.min(10, qualityScore))
  }

  const generateAdaptiveQuestions = async () => {
    setIsGeneratingAdaptive(true)

    try {
      const { data: responses } = await supabase
        .from('responses')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('question_number', { ascending: true })
        .limit(6)

      if (!responses || responses.length < 6) {
        throw new Error('Not enough responses')
      }

      const qualityScores = responses.map(r => ({
        question: r.question_text,
        answer: r.answer_text,
        score: analyzeAnswerQuality(r.answer_text)
      }))

      const avgQuality = qualityScores.reduce((sum, q) => sum + q.score, 0) / 6
      const weakAnswers = qualityScores.filter(q => q.score < 5)
      const vagueAnswers = qualityScores.filter(q => q.answer.split(' ').length < 30)

      let adaptiveCount
      if (avgQuality >= 7 && weakAnswers.length <= 1) {
        adaptiveCount = 2
      } else if (avgQuality >= 5.5 && weakAnswers.length <= 3) {
        adaptiveCount = 3
      } else if (weakAnswers.length >= 4 || vagueAnswers.length >= 4) {
        adaptiveCount = 5
      } else {
        adaptiveCount = 4
      }

      console.log(`Generating ${adaptiveCount} adaptive questions based on performance`)

      const blueprint = assessment.blueprint || {}
      const adaptiveQuestions = []

      const mentionedStress = responses.some(r =>
        /stress|pressure|busy|rush|overwhelm/i.test(r.answer_text)
      )
      const mentionedTeamwork = responses.some(r =>
        /team|colleague|coworker|together|collaborate/i.test(r.answer_text)
      )
      const mentionedCustomers = responses.some(r =>
        /customer|guest|client|patron/i.test(r.answer_text)
      )
      const mentionedMistakes = responses.some(r =>
        /mistake|error|wrong|fail|problem/i.test(r.answer_text)
      )

      for (let i = 0; i < adaptiveCount; i++) {
        const targetAnswer = weakAnswers[i] || qualityScores[i]
        let question

        const questionType = i % 5

        if (questionType === 0 && targetAnswer.answer.split(' ').length < 30) {
          question = {
            question_text: `Earlier you mentioned "${targetAnswer.answer.substring(0, 50)}..." - walk me through that situation in detail. What EXACTLY happened, what did YOU specifically do, and what was the outcome?`,
            ideal_answer_hints: 'Detailed step-by-step account, specific actions, concrete results'
          }
        } else if (questionType === 1 && mentionedStress) {
          question = {
            question_text: `You mentioned dealing with stressful situations. Tell me about a time when you had to maintain quality standards despite being under extreme time pressure. What was at stake?`,
            ideal_answer_hints: 'Specific high-pressure scenario, quality maintained, stakes described'
          }
        } else if (questionType === 2 && mentionedTeamwork) {
          question = {
            question_text: `Describe a situation where you had to get results from a team member who wasn't cooperating or wasn't pulling their weight. How did you handle it?`,
            ideal_answer_hints: 'Difficult team situation, tactful approach, resolution achieved'
          }
        } else if (questionType === 3 && mentionedCustomers) {
          question = {
            question_text: `Tell me about a customer interaction that taught you something important about ${blueprint.industry || 'this industry'}. What was the lesson and how did you apply it afterward?`,
            ideal_answer_hints: 'Meaningful customer interaction, clear lesson learned, applied knowledge'
          }
        } else if (questionType === 4 || mentionedMistakes) {
          question = {
            question_text: `Describe a time you made a significant mistake at work that affected others. How did you handle it, and what changed in your approach afterward?`,
            ideal_answer_hints: 'Admits real mistake, shows accountability, demonstrates growth'
          }
        } else {
          const challenges = blueprint.challenges || []
          const challenge = challenges[i % challenges.length] || 'competing priorities'
          question = {
            question_text: `You're facing ${challenge} and your manager isn't available. You need to make a call that could impact the business. Walk me through how you'd make that decision.`,
            ideal_answer_hints: 'Decision-making process, considers stakeholders, shows judgment'
          }
        }

        adaptiveQuestions.push(question)
      }

    setAllQuestions([...allQuestions, ...adaptiveQuestions])
    const newTotal = 6 + adaptiveCount          // ← add this line
    setTotalQuestions(newTotal)
    setAdaptiveQuestionsGenerated(true)
    setIsGeneratingAdaptive(false)
    return newTotal                              // ← add this line

    } catch (error) {
      console.error('Error generating adaptive questions:', error)

      const fallback = [
        {
          question_text: "Describe the most challenging professional situation you've ever faced. What made it so difficult, and how did you navigate through it?",
          ideal_answer_hints: "Significant challenge, complexity described, resolution shown"
        },
        {
          question_text: "Tell me about a time you had to adapt your communication style to work effectively with someone very different from you.",
          ideal_answer_hints: "Shows adaptability, self-awareness, successful collaboration"
        },
        {
          question_text: "What's a professional goal you set for yourself that you didn't achieve? What happened, and what did you learn?",
          ideal_answer_hints: "Shows vulnerability, reflection, growth mindset"
        }
      ]

    setAllQuestions([...allQuestions, ...fallback])
    const newTotal = 6 + 3                      // ← add this line
    setTotalQuestions(newTotal)
    setAdaptiveQuestionsGenerated(true)
    setIsGeneratingAdaptive(false)
    return newTotal                             // ← add this line
    }
  }

const handleNextQuestion = async () => {
  if (!answer.trim()) {
    alert('Please provide an answer before continuing')
    return
  }

  const typingTime = Math.floor((Date.now() - typingStats.startTime) / 1000)

  await supabase
    .from('responses')
    .insert([{
      candidate_id: candidateId,
      question_number: currentQuestion + 1,
      question_text: allQuestions[currentQuestion].question_text,
      answer_text: answer,
      typing_pauses: typingStats.pauses,
      deletion_count: typingStats.deletions,
      typing_time_seconds: typingTime,
      copy_paste_attempts: copyPasteAttempts
    }])

  if (currentQuestion === 5 && !adaptiveQuestionsGenerated) {
    const newTotal = await generateAdaptiveQuestions() // ✅ capture returned value
    total = newTotal                                   // ✅ use it directly
  }
  const isLastQuestion = currentQuestion >= total - 1

  if (isLastQuestion) {
    handleSubmitAssessment()
  } else {
    setCurrentQuestion(currentQuestion + 1)
    setAnswer('')
    setCopyPasteAttempts(0)
    setTypingStats({
      pauses: 0,
      deletions: 0,
      startTime: Date.now(),
      lastKeystroke: null
    })
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

    await scoreAllAnswers()

    setStage('completed')
  }

  const handleAutoSubmit = async () => {
    if (answer.trim().length > 0) {
      const typingTime = Math.floor((Date.now() - typingStats.startTime) / 1000)
      await supabase
        .from('responses')
        .insert([{
          candidate_id: candidateId,
          question_number: currentQuestion + 1,
          question_text: allQuestions[currentQuestion].question_text,
          answer_text: answer,
          typing_pauses: typingStats.pauses,
          deletion_count: typingStats.deletions,
          typing_time_seconds: typingTime,
          copy_paste_attempts: copyPasteAttempts
        }])
    }

    handleSubmitAssessment()
  }

  const scoreAllAnswers = async () => {
    console.log('Starting AI scoring with Hugging Face...')

    const { data: responses } = await supabase
      .from('responses')
      .select('*')
      .eq('candidate_id', candidateId)

    if (!responses || responses.length === 0) {
      console.log('No responses to score')
      return
    }

    console.log(`Scoring ${responses.length} responses...`)

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i]
      console.log(`Scoring response ${i + 1}/${responses.length}`)

      try {
        const analysis = await analyzeAnswerWithAI(response.answer_text)

        let score = 5

        if (analysis.isSpecific) score += 2
        if (analysis.isProfessional) score += 1.5
        if (analysis.hasExperience) score += 1.5
        if (analysis.isVague) score -= 2
        if (analysis.isUnprofessional) score -= 1.5

        const wordCount = response.answer_text.split(' ').length
        if (wordCount > 100) score += 0.5
        if (wordCount < 30) score -= 1

        score = Math.max(1, Math.min(10, score))

        const feedback = generateAIFeedback(analysis, wordCount, score)

        await supabase
          .from('responses')
          .update({
            ai_score: score,
            ai_feedback: feedback
          })
          .eq('id', response.id)

        console.log(`✅ Scored response ${i + 1}: ${score.toFixed(1)}/10`)

        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error scoring response ${i + 1}:`, error)

        const fallbackScore = analyzeAnswerQuality(response.answer_text)
        await supabase
          .from('responses')
          .update({
            ai_score: fallbackScore,
            ai_feedback: 'AI analysis unavailable. Score based on basic quality metrics.'
          })
          .eq('id', response.id)
      }
    }
    console.log('Finished scoring all responses')
  }

  // ✅ FIXED: analyzeAnswerWithAI — was closed too early, return statement was outside the function
  const analyzeAnswerWithAI = async (answerText) => {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: answerText,
            parameters: {
              candidate_labels: [
                "specific and detailed answer with examples",
                "vague and generic response",
                "professional and articulate",
                "unprofessional or casual",
                "demonstrates real experience",
                "lacks concrete experience",
                "confident and assertive",
                "uncertain or evasive"
              ],
              multi_label: true
            }
          })
        }
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      const scores = {}
      data.labels.forEach((label, index) => {
        scores[label] = data.scores[index]
      })

      // ✅ return is now INSIDE the try block, INSIDE the function
      return {
        isSpecific: scores["specific and detailed answer with examples"] > 0.5,
        isVague: scores["vague and generic response"] > 0.5,
        isProfessional: scores["professional and articulate"] > 0.5,
        isUnprofessional: scores["unprofessional or casual"] > 0.5,
        hasExperience: scores["demonstrates real experience"] > 0.5,
        isConfident: scores["confident and assertive"] > 0.5,
        topLabel: data.labels[0],
        topScore: data.scores[0]
      }

    } catch (error) {
      console.error('Hugging Face API error:', error)
      // ✅ fallback return is now INSIDE the catch block, INSIDE the function
      return {
        isSpecific: /example|instance|time when|specifically/i.test(answerText),
        isVague: answerText.split(' ').length < 50,
        isProfessional: true,
        isUnprofessional: false,
        hasExperience: /previous|experience|worked|role/i.test(answerText),
        isConfident: true,
        topLabel: "analysis unavailable",
        topScore: 0
      }
    }
  } // ✅ closes analyzeAnswerWithAI

  const generateAIFeedback = (analysis, wordCount, score) => {
    let feedback = []

    if (analysis.isSpecific) {
      feedback.push("Provides specific details and examples")
    }
    if (analysis.isProfessional) {
      feedback.push("Professional and well-articulated communication")
    }
    if (analysis.hasExperience) {
      feedback.push("Demonstrates relevant experience")
    }
    if (analysis.isConfident) {
      feedback.push("Confident and assertive tone")
    }

    if (analysis.isVague) {
      feedback.push("Response lacks specific examples")
    }
    if (analysis.isUnprofessional) {
      feedback.push("Could be more professional in tone")
    }
    if (wordCount < 50) {
      feedback.push("Answer is too brief - needs more depth")
    }
    if (!analysis.hasExperience) {
      feedback.push("Should demonstrate more real-world experience")
    }

    let summary
    if (score >= 8) {
      summary = "Excellent response showing strong capabilities."
    } else if (score >= 6.5) {
      summary = "Good answer with minor areas for improvement."
    } else if (score >= 5) {
      summary = "Acceptable but needs more depth and specificity."
    } else {
      summary = "Answer does not adequately demonstrate required competencies."
    }

    if (feedback.length > 0) {
      return `${summary} ${feedback.join('; ')}.`
    } else {
      return summary
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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

  if (stage === 'info') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">AgenticHire Assessment</h1>
          <h2 className="text-xl text-gray-700 mb-6">Role: {assessment.role_title}</h2>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
            <h3 className="font-bold text-blue-900 mb-2">Instructions:</h3>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>You have <strong>20 minutes</strong> to complete this assessment</li>
              <li>Answer all questions thoughtfully and honestly</li>
              <li>Provide specific examples from your real experience</li>
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

  if (stage === 'assessment') {
    if (currentQuestion === 6 && isGeneratingAdaptive) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-blue-600 mb-4">Processing Your Responses...</h2>
            <p className="text-gray-600 mb-4">
              Please wait while we prepare your next questions.
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Assessment in Progress</p>
                <div className="w-64 h-2 bg-gray-200 rounded-full mt-2">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${Math.min(90, (currentQuestion + 1) * 12)}%` }}
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

          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {allQuestions[currentQuestion]?.question_text || 'Loading question...'}
            </h2>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onCopy={(e) => {
                e.preventDefault()
                setCopyPasteAttempts(prev => prev + 1)
              }}
              onCut={(e) => {
                e.preventDefault()
                setCopyPasteAttempts(prev => prev + 1)
              }}
              placeholder="Type your answer here..."
              className="w-full h-64 px-4 py-3 border-2 border-gray-300 rounded-lg text-lg resize-none focus:border-blue-500 focus:outline-none"
            />

            <div className="flex justify-between items-center mt-4">
              {currentQuestion > 0 && currentQuestion < 6 && (
                <button
                  onClick={async () => {
                    if (answer.trim()) {
                      const typingTime = Math.floor((Date.now() - typingStats.startTime) / 1000)
                      await supabase
                        .from('responses')
                        .upsert({
                          candidate_id: candidateId,
                          question_number: currentQuestion + 1,
                          question_text: allQuestions[currentQuestion].question_text,
                          answer_text: answer,
                          typing_pauses: typingStats.pauses,
                          deletion_count: typingStats.deletions,
                          typing_time_seconds: typingTime,
                          copy_paste_attempts: copyPasteAttempts
                        }, {
                          onConflict: 'candidate_id,question_number'
                        })
                    }

                    const { data: prevResponse } = await supabase
                      .from('responses')
                      .select('*')
                      .eq('candidate_id', candidateId)
                      .eq('question_number', currentQuestion)
                      .single()

                    setCurrentQuestion(currentQuestion - 1)
                    setAnswer(prevResponse?.answer_text || '')
                    setCopyPasteAttempts(0)
                    setTypingStats({
                      pauses: 0,
                      deletions: 0,
                      startTime: Date.now(),
                      lastKeystroke: null
                    })
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  ← Previous
                </button>
              )}

              <button
                onClick={handleNextQuestion}
                disabled={!answer.trim()}
                className={`px-8 py-3 rounded-lg font-semibold transition ml-auto ${
                  !answer.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Continue →
              </button>
            </div>
          </div>{/* ✅ closes inner bg-white div (was missing) */}
        </div>
      </div>
    )
  }

  if (stage === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-green-600 mb-4">Assessment Complete!</h2>
          <p className="text-gray-700 mb-2">Thank you for completing the assessment.</p>
          <p className="text-gray-600 text-sm">
            Your responses have been submitted. The employer will review your results and contact you if selected.
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

