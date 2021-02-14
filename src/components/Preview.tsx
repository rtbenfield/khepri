import React, { useRef } from "react";

export function Preview(): JSX.Element {
  const previewRef = useRef<HTMLIFrameElement>(null);

  // TODO: Handle projects that don't use index.html as default
  return <iframe src="/dist/~/index.html" ref={previewRef} />;
}
