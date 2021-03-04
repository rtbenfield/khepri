import React from "react";
import ReactDOM from "react-dom";
import Modal from "react-modal";
import "web-streams-polyfill";
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

const root = window.document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

Modal.setAppElement(root);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  root,
);

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://snowpack.dev/concepts/hot-module-replacement
if (import.meta.hot) {
  import.meta.hot.accept();
}
