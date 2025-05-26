import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const formatDate = (date: string) => {
  return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })
}

export const calculateNPS = (scores: number[]) => {
  const total = scores.length
  if (total === 0) return 0
  
  const promoters = scores.filter(score => score >= 9).length
  const detractors = scores.filter(score => score <= 6).length
  
  return Math.round(((promoters - detractors) / total) * 100)
} 