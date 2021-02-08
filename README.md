# Khepri

Khepri explores the idea of a browser-first IDE experience built on the web platform. While other projects are also exploring this space, they are using build tools and workflows designed for development in a traditional desktop environment. Khepri attempts to start over using only web APIs and abandoning features that don't exist on the web platform.

Khepri is inspired by [Snowpack](https://www.snowpack.dev/), [Skypack](https://www.skypack.dev/), and talks by their founder [Fred K. Schott](http://fredkschott.com/). Snowpack and Skypack encourage the use of JavaScript modules (ESM) to solve modern application needs rather than reyling on legacy CommonJS tooling. The first idea for Khepri originated from searching for a web-based IDE that behaved similar to Snowpack, and Khepri attempts to fit that goal.

ESM can run natively in most browsers now and basic use cases can be satisfied with a simple HTML/JavaScript/CSS editor such as [Codepen](https://codepen.io/). However, there is still value in tooling for tasks like type checking and CSS imports. That is where Khepri comes in.
