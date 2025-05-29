import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const systemPrompt = `
You are a task parser that extracts structured information from natural language task descriptions.

Extract the following fields:
- task_name: The main action or task to be performed
- assignee: Person assigned to the task (if mentioned, otherwise null)
- due_date: Date in YYYY-MM-DD format (if mentioned, otherwise null)
- due_time: Time in HH:MM format using 24-hour notation (if mentioned, otherwise null)
- priority: P1 (urgent), P2 (high), P3 (normal), or P4 (low) - default to P3 if not specified

Handle relative dates:
- "tomorrow" = next day
- "next week" = 7 days from today
- "Monday", "Tuesday", etc. = next occurrence of that day
- "tonight" = today evening (18:00)
- "today" = current date

Examples:
Input: "Finish landing page Aman by 11pm 20th June"
Output: {"task_name": "Finish landing page", "assignee": "Aman", "due_date": "2024-06-20", "due_time": "23:00", "priority": "P3"}

Input: "Call client Rajeev tomorrow 5pm"
Output: {"task_name": "Call client", "assignee": "Rajeev", "due_date": "2024-05-30", "due_time": "17:00", "priority": "P3"}

Input: "High priority P1 meeting with John next Monday 2pm"
Output: {"task_name": "Meeting", "assignee": "John", "due_date": "2024-06-03", "due_time": "14:00", "priority": "P1"}

Return ONLY valid JSON. No additional text or formatting.
`

const meetingSystemPrompt = `
You are a meeting transcript parser that extracts individual tasks from meeting notes or transcripts.

Parse the meeting transcript and extract ALL individual tasks mentioned. For each task, extract:
- task_name: The main action or task to be performed
- assignee: Person assigned to the task
- due_date: Date in YYYY-MM-DD format (if mentioned, otherwise null)
- due_time: Time in HH:MM format using 24-hour notation (if mentioned, otherwise null)
- priority: P1 (urgent), P2 (high), P3 (normal), or P4 (low) - default to P3 if not specified

Handle relative dates and times:
- "tomorrow" = next day from today (${
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
})
- "tonight" = today evening at 18:00
- "today" = current date (${new Date().toISOString().split('T')[0]})
- "this week" = within 7 days
- "next week" = 7-14 days from today
- "Monday", "Tuesday", etc. = next occurrence of that day
- "end of week" = this Friday
- "Wednesday" = next Wednesday date

Look for action words like: "take", "handle", "review", "complete", "finish", "prepare", "contact", "follow-up", "call", "email", "send", "create", etc.

Examples:
Input: "Aman you take the landing page by 10pm tomorrow. Rajeev you take care of client follow-up by Wednesday. Shreya please review the marketing deck tonight."

Output: [
  {"task_name": "Take the landing page", "assignee": "Aman", "due_date": "2024-05-30", "due_time": "22:00", "priority": "P3"},
  {"task_name": "Client follow-up", "assignee": "Rajeev", "due_date": "2024-06-01", "due_time": null, "priority": "P3"},
  {"task_name": "Review the marketing deck", "assignee": "Shreya", "due_date": "2024-05-29", "due_time": "18:00", "priority": "P3"}
]

Return ONLY a valid JSON array of task objects. No additional text or formatting.
`

export async function parseNaturalLanguage(input) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
      temperature: 0.1,
      max_tokens: 200,
    })

    const response = completion.choices[0].message.content.trim()
    const parsedTask = JSON.parse(response)

    if (!parsedTask.task_name) {
      throw new Error('Task name is required')
    }

    // Set defaults for missing fields
    const task = {
      task_name: parsedTask.task_name,
      assignee: parsedTask.assignee || null,
      due_date: parsedTask.due_date || null,
      due_time: parsedTask.due_time || null,
      priority: parsedTask.priority || 'P3',
    }

    return task
  } catch (error) {
    console.error('OpenAI parsing error:', error)

    if (error.message.includes('JSON')) {
      return fallbackParse(input)
    }

    throw new Error(`Failed to parse task: ${error.message}`)
  }
}

export async function parseMeetingTranscript(transcript) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: meetingSystemPrompt },
        { role: 'user', content: transcript },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    })

    const response = completion.choices[0].message.content.trim()
    const parsedTasks = JSON.parse(response)

    // Ensure we have an array
    if (!Array.isArray(parsedTasks)) {
      throw new Error('Expected array of tasks')
    }

    // Validate and set defaults for each task
    const tasks = parsedTasks.map((task) => {
      if (!task.task_name || !task.assignee) {
        throw new Error('Task name and assignee are required')
      }

      return {
        task_name: task.task_name,
        assignee: task.assignee,
        due_date: task.due_date || null,
        due_time: task.due_time || null,
        priority: task.priority || 'P3',
      }
    })

    return tasks
  } catch (error) {
    console.error('Meeting transcript parsing error:', error)

    if (error.message.includes('JSON')) {
      return fallbackMeetingParse(transcript)
    }

    throw new Error(`Failed to parse meeting transcript: ${error.message}`)
  }
}

function fallbackParse(input) {
  const task = {
    task_name: input.trim(),
    assignee: null,
    due_date: null,
    due_time: null,
    priority: 'P3',
  }

  const nameMatch = input.match(/^(.+?)(?:\s+(by|for|with|to)\s+|$)/i)
  if (nameMatch) {
    task.task_name = nameMatch[1].trim()
  }

  const assigneeMatch = input.match(
    /(?:for|with|to|assign(?:ed)?\s+(?:to)?)\s+([A-Za-z]+)/i
  )
  if (assigneeMatch) {
    task.assignee = assigneeMatch[1]
  }

  const priorityMatch = input.match(/\b(P[1-4]|priority\s*[1-4])\b/i)
  if (priorityMatch) {
    const p = priorityMatch[1].toUpperCase()
    task.priority = p.includes('P') ? p : `P${p.slice(-1)}`
  }

  return task
}

function fallbackMeetingParse(transcript) {
  // Simple fallback: look for patterns like "Name you/should/need to [task]"
  const taskPatterns = [
    /(\w+)\s+(?:you|should|need to|please)\s+(.+?)(?:\.|$)/gi,
    /(\w+)\s+(?:take|handle|do|complete)\s+(.+?)(?:\.|$)/gi,
  ]

  const tasks = []

  for (const pattern of taskPatterns) {
    let match
    while ((match = pattern.exec(transcript)) !== null) {
      tasks.push({
        task_name: match[2].trim(),
        assignee: match[1],
        due_date: null,
        due_time: null,
        priority: 'P3',
      })
    }
  }

  return tasks.length > 0
    ? tasks
    : [
        {
          task_name: 'Review meeting transcript',
          assignee: null,
          due_date: null,
          due_time: null,
          priority: 'P3',
        },
      ]
}

export default {
  parseNaturalLanguage,
  parseMeetingTranscript,
}
