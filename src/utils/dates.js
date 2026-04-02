export function getDaysInMonth(year, month) {
  const days = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(date.toISOString().split('T')[0]);
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function isWeekend(dateStr) { return new Date(dateStr + 'T12:00:00').getDay() === 0; }
export function isSunday(dateStr) { return new Date(dateStr + 'T12:00:00').getDay() === 0; }
export function getWeekday(dateStr) { return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''); }
export function formatDate(dateStr) { return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
export function formatDateFull(dateStr) { return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
export function getMonthLabel(year, month) { return new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
export function getYearMonthStr(year, month) { return `${year}-${String(month + 1).padStart(2, '0')}`; }
export function isToday(dateStr) { return dateStr === new Date().toISOString().split('T')[0]; }
export function isPast(dateStr) { return new Date(dateStr + 'T12:00:00') < new Date().setHours(0, 0, 0, 0); }
export function getWorkingDays(year, month) { return getDaysInMonth(year, month).filter((d) => !isSunday(d)); }
