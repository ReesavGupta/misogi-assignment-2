import { useState, useEffect } from 'react'
import {
  Plus,
  Calendar,
  User,
  Edit3,
  Trash2,
  Check,
  X,
  FileText,
  Sparkles,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import {
  priorityColors,
  priorityLabels,
  sourceColors,
  sourceIcons,
} from '../constants/constants'

const API_BASE = 'http://localhost:4000/api'

const TaskManager = () => {
  const [tasks, setTasks] = useState([])
  const [input, setInput] = useState('')
  const [meetingTranscript, setMeetingTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [meetingLoading, setMeetingLoading] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [activeTab, setActiveTab] = useState('single')
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks`)
      const data = await response.json()
      if (data.success) {
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/parse-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      })

      const data = await response.json()
      if (data.success) {
        setTasks((prev) => [...prev, data.task])
        setInput('')
      } else {
        alert('Error creating task: ' + data.error)
      }
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleMeetingSubmit = async (e) => {
    e.preventDefault()
    if (!meetingTranscript.trim()) return

    setMeetingLoading(true)
    try {
      const response = await fetch(`${API_BASE}/parse-meeting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: meetingTranscript }),
      })

      const data = await response.json()
      if (data.success) {
        setTasks((prev) => [...prev, ...data.tasks])
        setMeetingTranscript('')
        alert(`✅ Successfully extracted ${data.count} tasks from the meeting!`)
      } else {
        alert('Error parsing meeting transcript: ' + data.error)
      }
    } catch (error) {
      console.error('Error parsing meeting:', error)
      alert('Network error occurred')
    } finally {
      setMeetingLoading(false)
    }
  }

  const handleEdit = (task) => {
    setEditingTask(task.id)
    setEditForm({
      task_name: task.task_name,
      assignee: task.assignee || '',
      due_date: task.due_date || '',
      due_time: task.due_time || '',
      priority: task.priority,
    })
  }

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${editingTask}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()
      if (data.success) {
        setTasks((prev) =>
          prev.map((task) => (task.id === editingTask ? data.task : task))
        )
        setEditingTask(null)
        setEditForm({})
      }
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return

    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        setTasks((prev) => prev.filter((task) => task.id !== taskId))
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleToggleComplete = async (taskId, currentStatus) => {
    try {
      const response = await fetch(
        `${API_BASE}/tasks/${taskId}/toggle-complete`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed: !currentStatus }),
        }
      )

      const data = await response.json()
      if (data.success) {
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? data.task : task))
        )
      }
    } catch (error) {
      console.error('Error toggling task completion:', error)
    }
  }

  const formatDateTime = (date, time) => {
    if (!date) return 'No due date'

    const dateObj = new Date(date)
    const dateStr = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    if (time) {
      const [hours, minutes] = time.split(':')
      const timeObj = new Date()
      timeObj.setHours(parseInt(hours), parseInt(minutes))
      const timeStr = timeObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      return `${timeStr}, ${dateStr}`
    }

    return dateStr
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (activeTab === 'single') {
        handleSubmit(e)
      }
    }
  }

  const filteredTasks = showCompleted
    ? tasks
    : tasks.filter((task) => !task.completed)

  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const source = task.source || 'single'
    if (!acc[source]) acc[source] = []
    acc[source].push(task)
    return acc
  }, {})

  const completedCount = tasks.filter((task) => task.completed).length
  const pendingCount = tasks.filter((task) => !task.completed).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Task Manager
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform natural language and meeting transcripts into organized
            tasks. Create individual tasks or extract multiple tasks from
            meeting notes automatically.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-xl mb-8 border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'single'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Single Task
              </div>
            </button>
            <button
              onClick={() => setActiveTab('meeting')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'meeting'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                Meeting Minutes
              </div>
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'single' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Describe your task in natural language
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder='e.g., "Finish landing page Aman by 11pm 20th June" or "Call client Rajeev tomorrow 5pm"'
                      className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 outline-none"
                      disabled={loading}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !input.trim()}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white p-3 rounded-lg transition-colors duration-200"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-xl p-4">
                  <h3 className="font-semibold text-indigo-900 mb-2">
                    Examples you can try:
                  </h3>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-indigo-700">
                    <div>"Review proposal John by Friday 3pm"</div>
                    <div>"High priority P1 meeting tomorrow 10am"</div>
                    <div>"Call client next Monday"</div>
                    <div>"Submit report by end of week"</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'meeting' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Paste your meeting transcript or notes
                  </label>
                  <div className="relative">
                    <textarea
                      value={meetingTranscript}
                      onChange={(e) => setMeetingTranscript(e.target.value)}
                      placeholder='e.g., "Aman you take the landing page by 10pm tomorrow. Rajeev you take care of client follow-up by Wednesday. Shreya please review the marketing deck tonight."'
                      className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 outline-none resize-none"
                      rows={6}
                      disabled={meetingLoading}
                    />
                    <button
                      onClick={handleMeetingSubmit}
                      disabled={meetingLoading || !meetingTranscript.trim()}
                      className="absolute bottom-3 right-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      {meetingLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Extract Tasks
                    </button>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-xl p-4">
                  <h3 className="font-semibold text-purple-900 mb-2">
                    How it works:
                  </h3>
                  <div className="text-sm text-purple-700 space-y-1">
                    <div>
                      • Paste meeting notes, email threads, or any text with
                      task assignments
                    </div>
                    <div>
                      • AI automatically identifies assignees, deadlines, and
                      priorities
                    </div>
                    <div>
                      • All extracted tasks appear in your task list below
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Your Tasks ({filteredTasks.length})
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-medium">
                  {completedCount} completed
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-orange-600 font-medium">
                  {pendingCount} pending
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showCompleted ? 'Hide Completed' : 'Show Completed'}
              </button>
              {Object.keys(groupedTasks).length > 1 && (
                <div className="flex gap-2 text-sm">
                  {Object.entries(groupedTasks).map(([source, tasks]) => {
                    const Icon = sourceIcons[source] || Plus
                    return (
                      <div
                        key={source}
                        className={`px-3 py-1 rounded-full border flex items-center gap-1 ${sourceColors[source]}`}
                      >
                        <Icon className="w-3 h-3" />
                        {source === 'single' ? 'Individual' : 'Meeting'} (
                        {tasks.length})
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {showCompleted ? 'No completed tasks' : 'No tasks yet'}
              </h3>
              <p className="text-gray-600">
                {showCompleted
                  ? 'Complete some tasks to see them here!'
                  : 'Add your first task using natural language or extract tasks from meeting notes!'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-100 overflow-hidden ${
                    task.completed ? 'opacity-75' : ''
                  }`}
                >
                  {editingTask === task.id ? (
                    // Edit Mode
                    <div className="p-6 space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Task Name
                          </label>
                          <input
                            type="text"
                            value={editForm.task_name}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                task_name: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Assignee
                          </label>
                          <input
                            type="text"
                            value={editForm.assignee}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                assignee: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={editForm.due_date}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                due_date: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Due Time
                          </label>
                          <input
                            type="time"
                            value={editForm.due_time}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                due_time: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Priority
                        </label>
                        <select
                          value={editForm.priority}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              priority: e.target.value,
                            }))
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="P1">P1 - Urgent</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Normal</option>
                          <option value="P4">P4 - Low</option>
                        </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingTask(null)
                            setEditForm({})
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() =>
                              handleToggleComplete(task.id, task.completed)
                            }
                            className={`mt-1 p-1 rounded-full transition-colors ${
                              task.completed
                                ? 'text-green-600 hover:text-green-700'
                                : 'text-gray-400 hover:text-green-600'
                            }`}
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3
                                className={`text-xl font-semibold ${
                                  task.completed
                                    ? 'text-gray-500 line-through'
                                    : 'text-gray-900'
                                }`}
                              >
                                {task.task_name}
                              </h3>
                              {task.source && (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                    sourceColors[task.source]
                                  }`}
                                >
                                  {task.source === 'meeting'
                                    ? 'Meeting'
                                    : 'Individual'}
                                </span>
                              )}
                              {task.completed && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                  Completed
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              {task.assignee && (
                                <div className="flex items-center gap-1">
                                  <User className="w-4 h-4" />
                                  <span>{task.assignee}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  {formatDateTime(task.due_date, task.due_time)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${
                              priorityColors[task.priority]
                            }`}
                          >
                            {priorityLabels[task.priority]}
                          </span>
                          <button
                            onClick={() => handleEdit(task)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Original input:
                        </div>
                        <div className="text-sm text-gray-700 italic">
                          "
                          {task.originalInput && task.originalInput.length > 100
                            ? task.originalInput.substring(0, 100) + '...'
                            : task.originalInput}
                          "
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskManager
