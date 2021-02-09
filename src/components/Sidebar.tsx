import React, { HTMLAttributes, PropsWithChildren } from "react";
import styles from "./Sidebar.module.css";

export function Pane({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>): JSX.Element {
  return <div className={`${styles.pane} ${className ?? ""}`} {...props} />;
}

export function PaneBody({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>): JSX.Element {
  return <div className={`${styles.paneBody} ${className ?? ""}`} {...props} />;
}

export function PaneHeader({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>): JSX.Element {
  return (
    <div className={`${styles.paneHeader} ${className ?? ""}`} {...props} />
  );
}

export function Sidebar({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>): JSX.Element {
  return <div className={`${styles.sidebar} ${className ?? ""}`} {...props} />;
}
