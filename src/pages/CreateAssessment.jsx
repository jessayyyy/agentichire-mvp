import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CreateAssessment() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [assessmentLink, setAssessmentLink] = useState('')
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  
  // Blueprint fields
  const [roleTitle, setRoleTitle] = useState('')
  const [industry, setIndustry] = useState('')
  const [responsibilities, setResponsibilities] = useState(['', '', ''])
  const [mustHaveSkills, setMustHaveSkills] = useState(['', '', ''])
  const [dealBreakers, setDealBreakers] = useState(['', ''])
  const [challenges, setChallenges] = useState(['', ''])
  const [focusAreas, setFocusAreas] = useState([])
  
  const employerEmail = localStorage.getItem('employerEmail')

  useEffect(() => {
    if (!employerEmail) {
      navigate('/')
    }
  }, [])

  const industries = [
    'Hospitality',
    'Food & Beverage',
    'Retail',
    'Customer Service',
    'Healthcare',
    'Other'
  ]

  const focusOptions = [
    'Customer Handling',
    'Conflict Resolution',
    'Stress Management',
    'Teamwork',
    'Problem-Solving',
    'Communication',
    'Work Ethic'
  ]

  const updateArrayField = (array, setArray, index, value) => {
    const newArray = [...array]
    newArray[index] = value
    setArray(newArray)
  }

  const addArrayField = (array, setArray) => {
    setArray([...array, ''])
  }

  const toggleFocusArea = (area) => {
    if (focusAreas.includes(area)) {
      setFocusAreas(focusAreas.filter(a => a !== area))
    } else {
      setFocusAreas([...focusAreas, area])
    }
  }

  const generateQuestionsFromBlueprint = async () => {
    setIsGeneratingQuestions(true)

    const blueprint = {
      role_title: roleTitle,
      industry,
      responsibilities: responsibilities.filter(r => r.trim()),
      must_have_skills: mustHaveSkills.filter(s => s.trim()),
      deal_breakers: dealBreakers.filter(d => d.trim()),
      challenges: challenges.filter(c => c.trim()),
      focus_areas: focusAreas
    }

    try {
      const prompt = `You are creating a hiring assessment for this role:

Role: ${roleTitle}
Industry: ${industry}

Key Responsibilities:
${blueprint.responsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Must-Have Skills:
${blueprint.must_have_skills.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Deal-Breakers:
${blueprint.deal_breakers.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Typical Challenges:
${blueprint.challenges.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Assessment Focus: ${blueprint.focus_areas.join(', ')}

Generate 6 behavioral interview questions that:
1. Test the must-have skills
2. Probe for deal-breaker behaviors
3. Present realistic challenges for this specific role
4. Are NOT generic (tailor them to THIS job)
5. Focus on the priority areas specified

Return ONLY a JSON array with 6 questions (no markdown, no backticks):
[
  {
    "question_text": "specific question here",
    "ideal_answer_hints": "what a good answer should include"
  },
  ...
]`

      // For MVP, using fallback questions
      // TODO: Add real Claude API call here
      const fallbackQuestions = [
        {
          question_text: `Tell me about a time you had to handle one of these responsibilities: ${blueprint.responsibilities[0] || 'a key task'}. What was the situation and outcome?`,
          ideal_answer_hints: 'Specific example, clear actions taken, measurable outcome'
        },
        {
          question_text: `Describe a situation where you demonstrated ${blueprint.must_have_skills[0] || 'a key skill'} under pressure.`,
          ideal_answer_hints: 'Real scenario, how they applied the skill, positive result'
        },
        {
          question_text: `How would you handle this challenge: ${blueprint.challenges[0] || 'a difficult situation'}?`,
          ideal_answer_hints: 'Step-by-step approach, consideration of stakeholders, professional resolution'
        },
        {
          question_text: `Tell me about a time you had to balance ${blueprint.responsibilities[0] || 'multiple tasks'} and ${blueprint.responsibilities[1] || 'competing priorities'}. How did you manage?`,
          ideal_answer_hints: 'Prioritization skills, time management, clear outcome'
        },
        {
          question_text: `Have you ever worked with someone who exhibited these behaviors: ${blueprint.deal_breakers[0] || 'unprofessional conduct'}? How did you handle it?`,
          ideal_answer_hints: 'Professional approach, conflict resolution, maintained standards'
        },
        {
          question_text: `In ${industry}, ${blueprint.challenges[1] || 'things can change quickly'}. Describe a time you had to adapt on the spot.`,
          ideal_answer_hints: 'Flexibility, quick thinking, positive adaptation'
        }
      ]

      setGeneratedQuestions(fallbackQuestions)
      setIsGeneratingQuestions(false)

    } catch (error) {
      console.error('Error generating questions:', error)
      alert('Error generating questions. Please try again.')
      setIsGeneratingQuestions(false)
    }
  }

  const handleCreateAssessment = async () => {
    if (!roleTitle.trim()) {
      alert('Please enter a role title')
      return
    }

    if (!industry) {
      alert('Please select an industry')
      return
    }

    if (generatedQuestions.length === 0) {
      alert('Please generate questions first')
      return
    }

    setLoading(true)

    const blueprint = {
      role_title: roleTitle,
      industry,
      responsibilities: responsibilities.filter(r => r.trim()),
      must_have_skills: mustHaveSkills.filter(s => s.trim()),
      deal_breakers: dealBreakers.filter(d => d.trim()),
      challenges: challenges.filter(c => c.trim()),
      focus_areas: focusAreas
    }

    // Create assessment
console.log('Generated questions:', generatedQuestions)
console.log('Blueprint:', blueprint)

const { data: assessment, error: assessmentError } = await supabase
  .from('assessments')
  .insert([{
    employer_email: employerEmail,
    role_title: roleTitle,
    selected_questions: generatedQuestions,
    blueprint: blueprint
  }])
  .select()
  .single()

if (assessmentError) {
  console.error('Assessment error:', assessmentError)
  alert(`Error creating assessment: ${assessmentError.message}`)
  setLoading(false)
  return
}

// Generate unique link - use assessment ID directly
const link = `${window.location.origin}/assessment/${assessment.id}`

// Don't create any candidate entries yet - they'll be created when someone clicks the link

    if (candidateError) {
      alert('Error generating link')
      console.error(candidateError)
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
          <h1 className="text-3xl font-bold text-blue-600">Create Smart Assessment</h1>
          <p className="text-gray-600">Fill in the job blueprint to generate tailored questions</p>
        </div>

        {/* Blueprint Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Job Blueprint</h2>

          {/* Role Title */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Role Title *</label>
            <input
              type="text"
              placeholder="e.g., Front Desk Associate, Barista, Sales Associate"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Industry */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Industry *</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select industry</option>
              {industries.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* Key Responsibilities */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Key Responsibilities</label>
            {responsibilities.map((resp, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Responsibility ${i + 1}`}
                value={resp}
                onChange={(e) => updateArrayField(responsibilities, setResponsibilities, i, e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
              />
            ))}
            <button
              onClick={() => addArrayField(responsibilities, setResponsibilities)}
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              + Add another
            </button>
          </div>

          {/* Must-Have Skills */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Must-Have Skills</label>
            {mustHaveSkills.map((skill, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Skill ${i + 1}`}
                value={skill}
                onChange={(e) => updateArrayField(mustHaveSkills, setMustHaveSkills, i, e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
              />
            ))}
            <button
              onClick={() => addArrayField(mustHaveSkills, setMustHaveSkills)}
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              + Add another
            </button>
          </div>

          {/* Deal-Breakers */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Deal-Breakers (What you DON'T want)</label>
            {dealBreakers.map((db, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Deal-breaker ${i + 1}`}
                value={db}
                onChange={(e) => updateArrayField(dealBreakers, setDealBreakers, i, e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
              />
            ))}
            <button
              onClick={() => addArrayField(dealBreakers, setDealBreakers)}
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              + Add another
            </button>
          </div>

          {/* Typical Challenges */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Typical Challenges in This Role</label>
            {challenges.map((ch, i) => (
              <input
                key={i}
                type="text"
                placeholder={`Challenge ${i + 1}`}
                value={ch}
                onChange={(e) => updateArrayField(challenges, setChallenges, i, e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
              />
            ))}
            <button
              onClick={() => addArrayField(challenges, setChallenges)}
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              + Add another
            </button>
          </div>

          {/* Assessment Focus */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Assessment Focus Areas</label>
            <div className="grid grid-cols-2 gap-2">
              {focusOptions.map(option => (
                <label key={option} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusAreas.includes(option)}
                    onChange={() => toggleFocusArea(option)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Generate Questions Button */}
          <button
            onClick={generateQuestionsFromBlueprint}
            disabled={isGeneratingQuestions || !roleTitle || !industry}
            className={`w-full py-3 rounded-lg font-semibold transition ${
              isGeneratingQuestions || !roleTitle || !industry
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isGeneratingQuestions ? '🤖 Generating Questions...' : '✨ Generate Custom Questions'}
          </button>
        </div>

        {/* Generated Questions Preview */}
        {generatedQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Generated Questions (Preview)</h2>
            <p className="text-sm text-gray-600 mb-4">
              These 6 questions are tailored to your job description. 
              The assessment will also include 2-5 adaptive follow-up questions based on candidate responses.
            </p>
            <ol className="list-decimal list-inside space-y-3">
              {generatedQuestions.map((q, i) => (
                <li key={i} className="text-gray-700">
                  <span className="font-medium">{q.question_text}</span>
                  <p className="text-sm text-gray-500 ml-6 mt-1">
                    Good answer should include: {q.ideal_answer_hints}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Create Assessment Button */}
        {generatedQuestions.length > 0 && (
          <button
            onClick={handleCreateAssessment}
            disabled={loading}
            className={`w-full py-4 rounded-lg font-bold text-lg transition ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Creating Assessment...' : '🚀 Create Assessment & Generate Link'}
          </button>
        )}
      </div>
    </div>
  )
}
