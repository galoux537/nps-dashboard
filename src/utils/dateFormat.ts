import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const formatDateTime = (dateString: string): string => {
  try {
    const date = parseISO(dateString)
    return format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR })
  } catch {
    return dateString
  }
} 