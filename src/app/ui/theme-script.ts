// Light / dark / follow the OS ("system", the default). The choice is a per-device convenience kept in
// localStorage; <html data-theme> always holds the resolved "light" | "dark" so CSS needs no media query.
export type ThemePref = "system" | "light" | "dark";
export const THEME_KEY = "seedling-theme";

const BG = { light: "#f4f2ec", dark: "#111513" };

// Runs inline in <head> before first paint (no flash of the wrong theme), and again on every change.
// Kept as a plain string so it does not depend on the React bundle being loaded.
export const THEME_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_KEY)},bg=${JSON.stringify(BG)};
function pref(){var p=null;try{p=localStorage.getItem(k)}catch(e){}return p==="light"||p==="dark"?p:"system"}
function apply(){var p=pref(),d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches),t=d?"dark":"light",r=document.documentElement;
r.dataset.theme=t;r.dataset.themePref=p;
var m=document.getElementById("theme-color");
if(!m){m=document.createElement("meta");m.id="theme-color";m.name="theme-color";document.head.appendChild(m)}
m.setAttribute("content",bg[t]);}
window.__seedlingTheme=apply;apply();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",apply);
}catch(e){}})();`;
