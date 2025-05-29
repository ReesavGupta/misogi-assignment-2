import { Plus, Users } from 'lucide-react'

export const priorityColors = {
  P1: 'bg-red-100 text-red-800 border-red-200',
  P2: 'bg-orange-100 text-orange-800 border-orange-200',
  P3: 'bg-blue-100 text-blue-800 border-blue-200',
  P4: 'bg-gray-100 text-gray-800 border-gray-200',
}

export const priorityLabels = {
  P1: 'Urgent',
  P2: 'High',
  P3: 'Normal',
  P4: 'Low',
}

export const sourceIcons = {
  single: Plus,
  meeting: Users,
}

export const sourceColors = {
  single: 'bg-blue-50 text-blue-700 border-blue-200',
  meeting: 'bg-purple-50 text-purple-700 border-purple-200',
}
