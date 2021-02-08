import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./index.css";

window.addEventListener("load", async function () {
  try {
    const registration = await navigator.serviceWorker.register("/dist/sw.js");
    // Registration was successful
    console.log(
      "ServiceWorker registration successful with scope: ",
      registration.scope,
    );
  } catch (err) {
    // registration failed :(
    console.log("ServiceWorker registration failed: ", err);
  }
});

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root"),
);

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://snowpack.dev/concepts/hot-module-replacement
if (import.meta.hot) {
  import.meta.hot.accept();
}
