import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
const router = Router()
import {
  parseNaturalLanguage,
  parseMeetingTranscript,
} from '../utils/openaiService.js'

// In-memory storage (replace with database in production)
let tasks = []
let taskIdCounter = 1

// Middleware for validation error handling
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array(),
    })
  }
  next()
}

// Middleware for async error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Validation schemas
const taskValidation = [
  body('input')
    .trim()
    .notEmpty()
    .withMessage('Input cannot be empty')
    .isLength({ max: 1000 })
    .withMessage('Input too long (max 1000 characters)'),
]

const meetingValidation = [
  body('transcript')
    .trim()
    .notEmpty()
    .withMessage('Meeting transcript cannot be empty')
    .isLength({ max: 10000 })
    .withMessage('Transcript too long (max 10000 characters)'),
]

const taskUpdateValidation = [
  body('task_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Task name must be 1-200 characters'),
  body('assignee')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Assignee name too long'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format (use YYYY-MM-DD)'),
  body('due_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format (use HH:MM)'),
  body('priority')
    .optional()
    .isIn(['P1', 'P2', 'P3', 'P4'])
    .withMessage('Priority must be P1, P2, P3, or P4'),
  body('completed')
    .optional()
    .isBoolean()
    .withMessage('Completed must be boolean'),
]

// Helper functions
const findTaskById = (id) => {
  const task = tasks.find((task) => task.id === parseInt(id))
  return task
}

const sortTasks = (tasksArray) => {
  return tasksArray.sort((a, b) => {
    // Completed tasks go to bottom
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }

    // Sort by priority (P1 highest, P4 lowest)
    const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 }
    if (a.priority !== b.priority) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }

    // Sort by due date
    if (a.due_date && b.due_date) {
      const dateA = new Date(`${a.due_date} ${a.due_time || '00:00'}`)
      const dateB = new Date(`${b.due_date} ${b.due_time || '00:00'}`)
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB
      }
    }

    // Tasks with due dates come first
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1

    // Sort by creation date as final fallback
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
}

const generateTaskResponse = (task) => ({
  ...task,
  created_at: task.createdAt,
  updated_at: task.updatedAt || null,
  is_overdue: task.due_date
    ? new Date(`${task.due_date} ${task.due_time || '23:59'}`) < new Date()
    : false,
})

// Routes

// Create single task from natural language
router.post(
  '/parse-task',
  taskValidation,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { input } = req.body

    try {
      const parsedTask = await parseNaturalLanguage(input)

      const task = {
        id: taskIdCounter++,
        ...parsedTask,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        originalInput: input,
        source: 'single',
        tags: [], // For future feature
        notes: '', // For future feature
      }

      tasks.push(task)

      res.status(201).json({
        success: true,
        task: generateTaskResponse(task),
        message: 'Task created successfully',
      })
    } catch (error) {
      console.error('Error parsing task:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to parse task',
        details: error.message,
      })
    }
  })
)

// Create multiple tasks from meeting transcript
router.post(
  '/parse-meeting',
  meetingValidation,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { transcript } = req.body

    try {
      const parsedTasks = await parseMeetingTranscript(transcript)

      if (!parsedTasks || parsedTasks.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No tasks found in the meeting transcript',
        })
      }

      const newTasks = parsedTasks.map((parsedTask) => ({
        id: taskIdCounter++,
        ...parsedTask,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        originalInput: transcript,
        source: 'meeting',
        tags: [],
        notes: '',
      }))

      tasks.push(...newTasks)

      res.status(201).json({
        success: true,
        tasks: newTasks.map(generateTaskResponse),
        count: newTasks.length,
        message: `Successfully extracted ${newTasks.length} tasks from meeting transcript`,
      })
    } catch (error) {
      console.error('Error parsing meeting transcript:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to parse meeting transcript',
        details: error.message,
      })
    }
  })
)

// Get all tasks with filtering and pagination
router.get(
  '/tasks',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be 1-100'),
    query('completed')
      .optional()
      .isBoolean()
      .withMessage('Completed must be boolean'),
    query('source')
      .optional()
      .isIn(['single', 'meeting'])
      .withMessage('Source must be single or meeting'),
    query('priority')
      .optional()
      .isIn(['P1', 'P2', 'P3', 'P4'])
      .withMessage('Invalid priority'),
    query('assignee').optional().trim(),
    query('overdue')
      .optional()
      .isBoolean()
      .withMessage('Overdue must be boolean'),
    query('search').optional().trim(),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      completed,
      source,
      priority,
      assignee,
      overdue,
      search,
    } = req.query

    let filteredTasks = [...tasks]

    // Apply filters
    if (completed !== undefined) {
      filteredTasks = filteredTasks.filter(
        (task) => task.completed === (completed === 'true')
      )
    }

    if (source) {
      filteredTasks = filteredTasks.filter((task) => task.source === source)
    }

    if (priority) {
      filteredTasks = filteredTasks.filter((task) => task.priority === priority)
    }

    if (assignee) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.assignee &&
          task.assignee.toLowerCase().includes(assignee.toLowerCase())
      )
    }

    if (overdue === 'true') {
      const now = new Date()
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.due_date &&
          !task.completed &&
          new Date(`${task.due_date} ${task.due_time || '23:59'}`) < now
      )
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.task_name.toLowerCase().includes(searchLower) ||
          (task.assignee &&
            task.assignee.toLowerCase().includes(searchLower)) ||
          (task.notes && task.notes.toLowerCase().includes(searchLower))
      )
    }

    // Sort tasks
    const sortedTasks = sortTasks(filteredTasks)

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit)
    const endIndex = startIndex + parseInt(limit)
    const paginatedTasks = sortedTasks.slice(startIndex, endIndex)

    // Statistics
    const stats = {
      total: tasks.length,
      filtered: sortedTasks.length,
      completed: tasks.filter((t) => t.completed).length,
      pending: tasks.filter((t) => !t.completed).length,
      overdue: tasks.filter(
        (t) =>
          t.due_date &&
          !t.completed &&
          new Date(`${t.due_date} ${t.due_time || '23:59'}`) < new Date()
      ).length,
      by_priority: {
        P1: tasks.filter((t) => t.priority === 'P1' && !t.completed).length,
        P2: tasks.filter((t) => t.priority === 'P2' && !t.completed).length,
        P3: tasks.filter((t) => t.priority === 'P3' && !t.completed).length,
        P4: tasks.filter((t) => t.priority === 'P4' && !t.completed).length,
      },
      by_source: {
        single: tasks.filter((t) => t.source === 'single').length,
        meeting: tasks.filter((t) => t.source === 'meeting').length,
      },
    }

    res.json({
      success: true,
      tasks: paginatedTasks.map(generateTaskResponse),
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_pages: Math.ceil(sortedTasks.length / parseInt(limit)),
        total_items: sortedTasks.length,
      },
      stats,
    })
  })
)

// Get single task by ID
router.get(
  '/tasks/:id',
  param('id').isInt({ min: 1 }).withMessage('Task ID must be positive integer'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const task = findTaskById(req.params.id)

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    res.json({
      success: true,
      task: generateTaskResponse(task),
    })
  })
)

// Update task
router.put(
  '/tasks/:id',
  param('id').isInt({ min: 1 }).withMessage('Task ID must be positive integer'),
  taskUpdateValidation,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id)
    const updates = req.body

    const taskIndex = tasks.findIndex((task) => task.id === taskId)

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    // Update task
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    res.json({
      success: true,
      task: generateTaskResponse(tasks[taskIndex]),
      message: 'Task updated successfully',
    })
  })
)

// Toggle task completion status
router.patch(
  '/tasks/:id/toggle-complete',
  param('id').isInt({ min: 1 }).withMessage('Task ID must be positive integer'),
  body('completed').isBoolean().withMessage('Completed must be boolean'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id)
    const { completed } = req.body

    const taskIndex = tasks.findIndex((task) => task.id === taskId)

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      completed,
      completedAt: completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }

    res.json({
      success: true,
      task: generateTaskResponse(tasks[taskIndex]),
      message: `Task ${completed ? 'completed' : 'reopened'} successfully`,
    })
  })
)

// Delete single task
router.delete(
  '/tasks/:id',
  param('id').isInt({ min: 1 }).withMessage('Task ID must be positive integer'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id)
    const taskIndex = tasks.findIndex((task) => task.id === taskId)

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0]

    res.json({
      success: true,
      task: generateTaskResponse(deletedTask),
      message: 'Task deleted successfully',
    })
  })
)

// Bulk operations
router.post(
  '/tasks/bulk-action',
  [
    body('action')
      .isIn(['delete', 'complete', 'incomplete', 'update_priority'])
      .withMessage('Invalid bulk action'),
    body('task_ids').isArray({ min: 1 }).withMessage('Task IDs array required'),
    body('task_ids.*')
      .isInt({ min: 1 })
      .withMessage('All task IDs must be positive integers'),
    body('priority')
      .optional()
      .isIn(['P1', 'P2', 'P3', 'P4'])
      .withMessage('Invalid priority'),
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { action, task_ids, priority } = req.body

    const affectedTasks = []
    const notFoundIds = []

    for (const taskId of task_ids) {
      const taskIndex = tasks.findIndex((task) => task.id === taskId)

      if (taskIndex === -1) {
        notFoundIds.push(taskId)
        continue
      }

      switch (action) {
        case 'delete':
          affectedTasks.push(tasks.splice(taskIndex, 1)[0])
          break
        case 'complete':
          tasks[taskIndex].completed = true
          tasks[taskIndex].completedAt = new Date().toISOString()
          tasks[taskIndex].updatedAt = new Date().toISOString()
          affectedTasks.push(tasks[taskIndex])
          break
        case 'incomplete':
          tasks[taskIndex].completed = false
          tasks[taskIndex].completedAt = null
          tasks[taskIndex].updatedAt = new Date().toISOString()
          affectedTasks.push(tasks[taskIndex])
          break
        case 'update_priority':
          if (priority) {
            tasks[taskIndex].priority = priority
            tasks[taskIndex].updatedAt = new Date().toISOString()
            affectedTasks.push(tasks[taskIndex])
          }
          break
      }
    }

    res.json({
      success: true,
      affected_tasks: affectedTasks.map(generateTaskResponse),
      affected_count: affectedTasks.length,
      not_found_ids: notFoundIds,
      message: `Bulk ${action} completed for ${affectedTasks.length} tasks`,
    })
  })
)

// Bulk delete by source
router.delete(
  '/tasks/bulk/:source',
  param('source')
    .isIn(['single', 'meeting'])
    .withMessage('Source must be single or meeting'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const source = req.params.source
    const initialCount = tasks.length

    const deletedTasks = tasks.filter((task) => task.source === source)
    tasks = tasks.filter((task) => task.source !== source)

    const deletedCount = initialCount - tasks.length

    res.json({
      success: true,
      deleted_tasks: deletedTasks.map(generateTaskResponse),
      deleted_count: deletedCount,
      message: `Deleted ${deletedCount} ${source} tasks`,
    })
  })
)

// Get task statistics
router.get(
  '/stats/overview',
  asyncHandler(async (req, res) => {
    const now = new Date()
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    )
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

    const stats = {
      total_tasks: tasks.length,
      completed_tasks: tasks.filter((t) => t.completed).length,
      pending_tasks: tasks.filter((t) => !t.completed).length,
      overdue_tasks: tasks.filter(
        (t) =>
          t.due_date &&
          !t.completed &&
          new Date(`${t.due_date} ${t.due_time || '23:59'}`) < now
      ).length,
      due_today: tasks.filter(
        (t) =>
          t.due_date &&
          !t.completed &&
          t.due_date === todayStart.toISOString().split('T')[0]
      ).length,
      due_this_week: tasks.filter((t) => {
        if (!t.due_date || t.completed) return false
        const dueDate = new Date(t.due_date)
        return (
          dueDate >= todayStart &&
          dueDate <= new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        )
      }).length,
      by_priority: {
        P1: tasks.filter((t) => t.priority === 'P1' && !t.completed).length,
        P2: tasks.filter((t) => t.priority === 'P2' && !t.completed).length,
        P3: tasks.filter((t) => t.priority === 'P3' && !t.completed).length,
        P4: tasks.filter((t) => t.priority === 'P4' && !t.completed).length,
      },
      by_source: {
        single: tasks.filter((t) => t.source === 'single').length,
        meeting: tasks.filter((t) => t.source === 'meeting').length,
      },
      assignees: [
        ...new Set(tasks.filter((t) => t.assignee).map((t) => t.assignee)),
      ],
      recent_activity: {
        created_today: tasks.filter((t) => new Date(t.createdAt) >= todayStart)
          .length,
        completed_today: tasks.filter(
          (t) => t.completedAt && new Date(t.completedAt) >= todayStart
        ).length,
        updated_today: tasks.filter(
          (t) => t.updatedAt && new Date(t.updatedAt) >= todayStart
        ).length,
      },
    }

    res.json({
      success: true,
      stats,
      generated_at: new Date().toISOString(),
    })
  })
)

// Export/Import tasks (for backup/restore)
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=tasks-export.json'
    )

    res.json({
      export_date: new Date().toISOString(),
      version: '1.0',
      task_count: tasks.length,
      tasks: tasks.map(generateTaskResponse),
    })
  })
)

router.post(
  '/import',
  body('tasks').isArray().withMessage('Tasks must be an array'),
  body('replace').optional().isBoolean().withMessage('Replace must be boolean'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { tasks: importTasks, replace = false } = req.body

    if (replace) {
      tasks = []
      taskIdCounter = 1
    }

    const importedTasks = []
    let skippedCount = 0

    for (const taskData of importTasks) {
      try {
        // Validate required fields
        if (!taskData.task_name) {
          skippedCount++
          continue
        }

        const task = {
          id: taskIdCounter++,
          task_name: taskData.task_name,
          assignee: taskData.assignee || null,
          due_date: taskData.due_date || null,
          due_time: taskData.due_time || null,
          priority: taskData.priority || 'P3',
          completed: taskData.completed || false,
          createdAt: taskData.created_at || new Date().toISOString(),
          updatedAt: taskData.updated_at || null,
          completedAt: taskData.completedAt || null,
          originalInput: taskData.originalInput || '',
          source: taskData.source || 'single',
          tags: taskData.tags || [],
          notes: taskData.notes || '',
        }

        tasks.push(task)
        importedTasks.push(task)
      } catch (error) {
        skippedCount++
        console.error('Error importing task:', error)
      }
    }

    res.json({
      success: true,
      imported_count: importedTasks.length,
      skipped_count: skippedCount,
      total_tasks: tasks.length,
      message: `Successfully imported ${importedTasks.length} tasks${
        skippedCount > 0 ? `, skipped ${skippedCount}` : ''
      }`,
    })
  })
)

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Route error:', error)

  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  })
})

export default router
