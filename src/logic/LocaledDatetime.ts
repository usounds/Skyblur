export const formatDateToLocale = (dateString: string) => {
  const date = new Date(dateString);
  let userLocale = 'en'; // default locale

  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    userLocale = navigator.language; // ブラウザのロケールを取得
  }

  return new Intl.DateTimeFormat(userLocale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false, // 24時間表示
  }).format(date);
};