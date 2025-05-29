import { Router } from 'express'
const router = Router()
import { parseNaturalLanguage } from '../utils/openaiService.js'

let tasks = []
let taskIdCounter = 1

router.post('/parse-task', async (req, res) => {
  try {
    const { input } = req.body

    if (!input || input.trim() === '') {
      return res.status(400).json({ error: 'Input cannot be empty' })
    }

    const parsedTask = await parseNaturalLanguage(input)

    const task = {
      id: taskIdCounter++,
      ...parsedTask,
      createdAt: new Date().toISOString(),
      originalInput: input,
    }

    tasks.push(task)

    res.json({
      success: true,
      task: task,
      message: 'Task created successfully',
    })
  } catch (error) {
    console.error('Error parsing task:', error)
    res.status(500).json({
      error: 'Failed to parse task',
      details: error.message,
    })
  }
})

router.get('/tasks', (req, res) => {
  try {
    const sortedTasks = tasks.sort((a, b) => {
      const dateA = new Date(`${a.due_date} ${a.due_time}`)
      const dateB = new Date(`${b.due_date} ${b.due_time}`)
      return dateA - dateB
    })

    res.json({
      success: true,
      tasks: sortedTasks,
      count: tasks.length,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

router.put('/tasks/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id)
    const updates = req.body

    const taskIndex = tasks.findIndex((task) => task.id === taskId)

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    res.json({
      success: true,
      task: tasks[taskIndex],
      message: 'Task updated successfully',
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' })
  }
})

router.delete('/tasks/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id)
    const taskIndex = tasks.findIndex((task) => task.id === taskId)

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    tasks.splice(taskIndex, 1)

    res.json({
      success: true,
      message: 'Task deleted successfully',
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' })
  }
})

export default router

