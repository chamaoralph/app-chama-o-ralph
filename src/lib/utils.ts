import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formata data ISO para DD/MM/YYYY (sem conversão de timezone)
export function formatarDataBR(dataString: string | null): string {
  if (!dataString) return '-'
  const dataPart = dataString.includes('T') 
    ? dataString.split('T')[0] 
    : dataString.split(' ')[0]
  const [ano, mes, dia] = dataPart.split('-')
  return `${dia}/${mes}/${ano}`
}

// Formata timestamp para DD/MM/YYYY às HH:MM (sem conversão de timezone)
export function formatarDataHoraBR(dataString: string | null): string {
  if (!dataString) return '-'
  const [dataPart, horaPart] = dataString.includes('T') 
    ? dataString.split('T') 
    : dataString.split(' ')
  const [ano, mes, dia] = dataPart.split('-')
  const hora = horaPart ? horaPart.substring(0, 5) : '00:00'
  return `${dia}/${mes}/${ano} às ${hora}`
}

// Extrai apenas o horário HH:MM de um timestamp
export function formatarHorarioBR(dataString: string | null): string {
  if (!dataString) return '-'
  const horaPart = dataString.includes('T') 
    ? dataString.split('T')[1] 
    : dataString.split(' ')[1]
  return horaPart ? horaPart.substring(0, 5) : '00:00'
}
