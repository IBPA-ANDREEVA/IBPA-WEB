export type BeautyGivesBackConfig = {
  offerFormUrl: string;
  requestFormUrl: string;
  catalogCsvUrl: string;
};

/** Public, moderated «Каталог» only; verified anonymously on 2026-11-24. */
export const BEAUTY_GIVES_BACK_CONFIG: BeautyGivesBackConfig = {
  offerFormUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSdm8h0c9Y6SoQgeUR0N3JBfrjXx_y24iUEXvsoRLyUECIWy8w/viewform",
  requestFormUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSeiDV4E_JaJbTFDKe8TP86J-kGHNRW-5sNvxtLK2-cYdVun4w/viewform",
  catalogCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLIYUsXqdvJQRmnYCxek68aoOQE6-Z5cEAdbg5sGLKc66QbB5HXjbclJs-_sBiep4PXkOOSS0PZ-Gj/pub?gid=95794855&single=true&output=csv",
};
export const CATALOG_REFRESH_MS = 60_000;
export const CATALOG_TIMEOUT_MS = 10_000;
