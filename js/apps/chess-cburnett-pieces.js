// Lichess' default piece theme is "cburnett" (SVG).
//
// The SVGs below are based on the well-known "Chess pieces" by Colin M. Burnett (user:Cburnett),
// which are available under multiple licenses (including a permissive BSD license).
//
// Keep this file dependency-free: it should be safe to import from anywhere in the app.

export const CHESS_CBURNETT_PIECE_SVGS = {
    p: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <path fill="#000" stroke="#000" stroke-linecap="round" stroke-width="1.5"
    d="M22.5 9a4 4 0 0 0-3.22 6.38 6.48 6.48 0 0 0-.87 10.65c-3 1.06-7.5 5-7.5 13.5h23c0-8.5-4.5-12.44-7.5-13.5a6.49 6.49 0 0 0-.87-10.65A4 4 0 0 0 22.5 9Z" />
</svg>`,
    P: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <path fill="#fff" stroke="#000" stroke-linecap="round" stroke-width="1.5"
    d="M22.5 9a4 4 0 0 0-3.22 6.38 6.48 6.48 0 0 0-.87 10.65c-3 1.06-7.5 5-7.5 13.5h23c0-8.5-4.5-12.44-7.5-13.5a6.49 6.49 0 0 0-.87-10.65A4 4 0 0 0 22.5 9Z" />
</svg>`,
    r: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <path fill="#000" stroke="#000" stroke-linecap="round" stroke-width="1.5"
    d="M9 39h27v-3H9v3Zm3.5-7 1.5 2.5h17L32.5 32l-2-4H14.5l-2 4Zm.5-13V9h4v2h5V9h5v2h5V9h4v10" />
  <path stroke="#fff" stroke-linecap="round" stroke-width="1.5"
    d="M11 14h23M11 17h23M11 20h23M11 23h23" />
</svg>`,
    R: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <path fill="#fff" stroke="#000" stroke-linecap="round" stroke-width="1.5"
    d="M9 39h27v-3H9v3Zm3-7 1.5 2.5h17L32 32l-2-4H15l-2 4Zm0-13V9h4v2h5V9h5v2h5V9h4v10" />
  <path stroke="#000" stroke-linecap="round" stroke-width="1.5"
    d="M11 14h23M11 17h23M11 20h23M11 23h23" />
</svg>`,
    n: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <path fill="#000" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
  <path fill="#000" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0-.19 1.23-1 2-1 0-4-1-4-2 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3" />
  <path stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM15 15.5a.5 1.5 0 1 1-1 0 .5 1.5 0 0 1 1 0Z" />
  <path fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M24.55 10.4 24.1 11.85l.95.15c-.5.5-1.5 1.5-3 1.5-2.5 0-2.5-2.5-2.5-2.5s1.5-1 2.5-.5c.77.38.91.78 1.2 1.6Z" />
</svg>`,
    N: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <path fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
  <path fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0-.19 1.23-1 2-1 0-4-1-4-2 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3" />
  <path stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM15 15.5a.5 1.5 0 1 1-1 0 .5 1.5 0 0 1 1 0Z" />
  <path fill="#000" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M24.55 10.4 24.1 11.85l.95.15c-.5.5-1.5 1.5-3 1.5-2.5 0-2.5-2.5-2.5-2.5s1.5-1 2.5-.5c.77.38.91.78 1.2 1.6Z" />
</svg>`,
    b: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <g fill="#000" stroke="#000" stroke-linecap="round" stroke-width="1.5">
    <path stroke-linejoin="round"
      d="M9 36c3.4-.97 10.1.43 13.5-2 3.4 2.43 10.1 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65 1-3 .5-3.4-.97-10.1.46-13.5-1-3.4 1.46-10.1.03-13.5 1-1.35.5-2.32.47-3-.5 1.35-1.94 3-2 3-2Z" />
    <path stroke-linejoin="round"
      d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2Z" />
    <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
  </g>
  <path fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" />
</svg>`,
    B: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <g fill="#fff" stroke="#000" stroke-linecap="round" stroke-width="1.5">
    <path stroke-linejoin="round"
      d="M9 36c3.4-.97 10.1.43 13.5-2 3.4 2.43 10.1 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65 1-3 .5-3.4-.97-10.1.46-13.5-1-3.4 1.46-10.1.03-13.5 1-1.35.5-2.32.47-3-.5 1.35-1.94 3-2 3-2Z" />
    <path stroke-linejoin="round"
      d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2Z" />
    <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
  </g>
  <path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
    d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" />
</svg>`,
    q: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <g fill="#000" stroke="#000" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15L14 11v14L7 14l2 12Z" />
    <path stroke-linecap="round"
      d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0Z" />
    <path stroke-linecap="round" d="M11.5 38.5a35 35 0 0 0 23 0" />
    <path fill="#fff" stroke="none"
      d="M11 29a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM15 15a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM24 8.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM32 15a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM36 29a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" />
  </g>
</svg>`,
    Q: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <g fill="#fff" stroke="#000" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15L14 11v14L7 14l2 12Z" />
    <path stroke-linecap="round"
      d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0Z" />
    <path stroke-linecap="round" d="M11.5 38.5a35 35 0 0 0 23 0" />
    <path fill="#000" stroke="none"
      d="M11 29a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM15 15a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM24 8.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM32 15a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0ZM36 29a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" />
  </g>
</svg>`,
    k: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <g fill="#000" stroke="#000" stroke-linecap="round" stroke-width="1.5">
    <path stroke-linejoin="round"
      d="M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5Z" />
    <path fill="#000" stroke="#000" stroke-linejoin="round"
      d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-4c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37Z" />
    <path stroke-linejoin="round" d="M20 29.5h5" />
    <path stroke-linejoin="round" d="M32 28.5a14 14 0 0 1-19 0" />
    <path stroke-linejoin="round" d="M11.5 30c5.5-3 16.5-3 22 0" />
  </g>
  <path fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1.5"
    d="M20 11.5h5M22.5 6.5v5M20 23h5m-2.5-1v5" />
</svg>`,
    K: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 45 45">
  <g fill="#fff" stroke="#000" stroke-linecap="round" stroke-width="1.5">
    <path stroke-linejoin="round"
      d="M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5Z" />
    <path fill="#fff" stroke="#000" stroke-linejoin="round"
      d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-4c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37Z" />
    <path stroke-linejoin="round" d="M20 29.5h5" />
    <path stroke-linejoin="round" d="M32 28.5a14 14 0 0 1-19 0" />
    <path stroke-linejoin="round" d="M11.5 30c5.5-3 16.5-3 22 0" />
  </g>
</svg>`,
};
