/** Runs before paint. Theme preference is local UI state, never workspace data. */
export const THEME_INIT = `(function(){var t;try{t=localStorage.getItem('agency:theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`;
