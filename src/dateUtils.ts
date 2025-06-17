// 日付バリデーション（YYYY-MM-DD形式、有効な日付かチェック）
export function isValidDate(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString + 'T00:00:00Z');
  const [year, month, day] = dateString.split('-').map(Number);
  
  return date.getUTCFullYear() === year &&
         date.getUTCMonth() === month - 1 &&
         date.getUTCDate() === day;
}

// 今日の日付を YYYY-MM-DD 形式で取得（JSTタイムゾーン）
export function getTodayDate(): string {
  const now = new Date();
  // JSTタイムゾーン（UTC+9）に調整
  const jstOffset = 9 * 60; // 9時間をミニッツに変換
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  
  return jstTime.toISOString().split('T')[0];
}

// 月の日数を取得（アーカイブ表示用）
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// JST変換（表示用）
export function formatDateForDisplay(isoString: string): string {
  const date = new Date(isoString);
  const jstOffset = 9 * 60; // 9時間をミニッツに変換
  const jstTime = new Date(date.getTime() + jstOffset * 60 * 1000);
  
  return jstTime.toISOString().replace('T', ' ').replace('Z', ' JST').substring(0, 19) + ' JST';
}

// YYYY-MM-DD形式の日付文字列を表示用にフォーマット
export function formatDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  return `${year}年${parseInt(month)}月${parseInt(day)}日`;
}

// HTMLエスケープ（XSS対策）
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// 改行をHTMLの<br>タグに変換
export function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}