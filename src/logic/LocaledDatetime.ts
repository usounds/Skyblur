export const formatDateToLocale = (dateString: string) => {
    const date = new Date(dateString);
    const userLocale = navigator.language; // ブラウザのロケールを取得

    return new Intl.DateTimeFormat(userLocale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false, // 24時間表示
    }).format(date);
};