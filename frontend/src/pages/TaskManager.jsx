import { useState, useEffect } from 'react'
import { Plus, Calendar, User, Edit3, Trash2, Check, X } from 'lucide-react'

const API_BASE = 'http://localhost:4000/api'

const TaskManager = () => {
  const [tasks, setTasks] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editForm, setEditForm] = useState({})

  const priorityColors = {
    P1: 'bg-red-100 text-red-800 border-red-200',
    P2: 'bg-orange-100 text-orange-800 border-orange-200',
    P3: 'bg-blue-100 text-blue-800 border-blue-200',
    P4: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  const priorityLabels = {
    P1: 'Urgent',
    P2: 'High',
    P3: 'Normal',
    P4: 'Low',
  }

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
      handleSubmit(e)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Natural Language Task Manager
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your natural language into organized tasks. Simply type
            what you need to do, and we'll extract all the details
            automatically.
          </p>
        </div>

        {/* Task Input Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
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
        </div>

        {/* Tasks List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Your Tasks ({tasks.length})
            </h2>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No tasks yet
              </h3>
              <p className="text-gray-600">
                Add your first task using natural language above!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-100 overflow-hidden"
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
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {task.task_name}
                          </h3>
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
                          "{task.originalInput}"
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
