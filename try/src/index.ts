/// <reference path="../../types/wicg-file-system-access.d.ts" />

import { customElement, html, LitElement, property } from "lit-element";
import { build } from "@khepri/scarab";
import { getPlugin as esbuild } from "@khepri/plugins/esbuild.ts";

@customElement("khepri-try")
export class KhepriTry extends LitElement {
  @property()
  workspace: FileSystemDirectoryHandle | null = null;

  private async handleBuild(): Promise<void> {
    if (!this.workspace) return;
    const out = await this.workspace.getDirectoryHandle("build", {
      create: true,
    });
    await build({
      config: {
        logger: console,
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
  }

  public render() {
    return html`
      <button @click=${this.handleSelectWorkspace} type="button">
        Select Workspace
      </button>
      <button @click=${this.handleBuild} type="button">
        Build
      </button>
    `;
  }
}
