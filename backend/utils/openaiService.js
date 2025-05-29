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

Examples:
Input: "Finish landing page Aman by 11pm 20th June"
Output: {"task_name": "Finish landing page", "assignee": "Aman", "due_date": "2024-06-20", "due_time": "23:00", "priority": "P3"}

Input: "Call client Rajeev tomorrow 5pm"
Output: {"task_name": "Call client", "assignee": "Rajeev", "due_date": "2024-05-30", "due_time": "17:00", "priority": "P3"}

Input: "High priority P1 meeting with John next Monday 2pm"
Output: {"task_name": "Meeting", "assignee": "John", "due_date": "2024-06-03", "due_time": "14:00", "priority": "P1"}

Return ONLY valid JSON. No additional text or formatting.
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

export default {
  parseNaturalLanguage,
}

