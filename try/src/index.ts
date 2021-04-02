/// <reference path="../../types/wicg-file-system-access.d.ts" />

import { customElement, html, LitElement, property } from "lit-element";
import { build } from "@khepri/scarab";
import { getPlugin as esbuild } from "@khepri/plugins/esbuild.ts";

@customElement("khepri-try")
export class KhepriTry extends LitElement {
  #logger: Console = new Proxy(console, {
    get: (target, prop, receiver) => {
      const base = Reflect.get(target, prop, receiver);
      switch (prop) {
        case "clear":
          return (...args: unknown[]) => {
            this.logs = [];
            return base(...args);
          };
        default:
          return (...args: unknown[]) => {
            this.logs = [...this.logs, args];
            return base(...args);
          };
      }
    },
  });

  @property()
  logs: unknown[] = [];

  @property()
  workspace: FileSystemDirectoryHandle | null = null;

  private async handleBuild(): Promise<void> {
    if (!this.workspace) return;
    this.#logger.clear();
    const out = await this.workspace.getDirectoryHandle("build", {
      create: true,
    });
    await build({
      config: {
        logger: this.#logger,
        mount: [
          {
            root: await this.workspace.getDirectoryHandle("src"),
            static: false,
            url: "/src",
          },
          {
            root: await this.workspace.getDirectoryHandle("public"),
            static: true,
            url: "/",
          },
        ],
        plugins: [esbuild],
        root: this.workspace,
      },
      out,
    });
  }

  private async handleSelectWorkspace(): Promise<void> {
    this.workspace = await window.showDirectoryPicker();
    if (this.workspace) {
      this.logs.push(`ready to build directory "${this.workspace.name}"`);
    }
  }

  public render() {
    return html`
      <button @click=${this.handleSelectWorkspace} type="button">
        Select Workspace
      </button>
      <button @click=${this.handleBuild} type="button">
        Build
      </button>
      <pre>${this.logs.join("\n")}</pre>
    `;
  }
}
