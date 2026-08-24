import { Streamdown } from "streamdown";
import "streamdown/styles.css";

export function StreamingResponse({
  children,
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  return <Streamdown mode={streaming ? "streaming" : "static"}>{children}</Streamdown>;
}
