import React, { HTMLAttributes, PropsWithChildren } from "react";
import styles from "./StatusBar.module.css";

export function StatusBar({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLElement>>): JSX.Element {
  return <footer className={`${styles.root} ${className ?? ""}`} {...props} />;
}

export function StatusBarItem({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>): JSX.Element {
  return <div className={`${styles.item} ${className ?? ""}`} {...props} />;
}

export function StatusBarSpacer(): JSX.Element {
  return <div className={styles.spacer} />;
}
