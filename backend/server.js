import express, { json } from 'express'
import cors from 'cors'
import 'dotenv/config' // No need to call dotenv.config() again

import taskRoutes from './routes/tasks.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(json())

app.use('/api', taskRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

