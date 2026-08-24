import { Virtuoso } from "react-virtuoso";
import { StreamingResponse } from "./StreamingResponse";

export type TimelineItem = {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  streaming?: boolean;
};

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <Virtuoso
      className="timeline"
      data={items}
      followOutput="smooth"
      initialTopMostItemIndex={Math.max(0, items.length - 1)}
      itemContent={(_index, item) => (
        <article className={`message message-${item.role}`}>
          <span className="message-role">{item.role}</span>
          <StreamingResponse streaming={item.streaming}>{item.content}</StreamingResponse>
        </article>
      )}
    />
  );
}
