# Khepri

Khepri is a group of projects orbiting around the idea of building modern JavaScript developments tools on the web platform. Khepri projects rely on web platform APIs to ensure maximum compatibility with modern browsers and other spec-compliant JavaScript runtimes (like Deno!).

Khepri is inspired by [Snowpack](https://www.snowpack.dev/), [Skypack](https://www.skypack.dev/), and talks by their founder [Fred K. Schott](http://fredkschott.com/). Snowpack and Skypack encourage the use of JavaScript modules (ESM) to solve modern application needs rather than reyling on legacy CommonJS tooling. The first idea for Khepri originated from searching for a web-based IDE that behaved similar to Snowpack, and Khepri attempts to fit that goal.

ESM can run natively in most browsers now and basic use cases can be satisfied with a simple HTML/JavaScript/CSS editor such as [Codepen](https://codepen.io/). However, there is still value in tooling for tasks like type checking and CSS imports. That is where Khepri comes in.

Khepri is still experimental and will rapidly change.

## Goals

- Rely on web platform APIs as much as possible, even if those APIs are experimental.
- Provide a suite of tools that explore migrating modern web development into the web platform. Much like [Pika](https://www.pika.dev/), Khepri will do a lot of experimenting. Some projects may stick, others may not.

## Projects

- [Scarab (Khepri core)](./scarab/README.md) is the core engine that powers Khepri projects. It is JavaScript runtime agnostic and relies on web platform standards.
- [Khepri Code](./code/README.md) is an experimental code editor built on Scarab.
- [Khepri Deno](./deno/README.md) is a Deno wrapper and CLI for Scarab.
